import { join } from 'path'
import { readdirSync, statSync } from 'fs'
import { RPC_CHANNELS, type SkillFile } from '@depot/shared/protocol'
import { getWorkspaceByNameOrId } from '@depot/shared/config'
import type { RpcServer } from '@depot/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.skills.GET,
  RPC_CHANNELS.skills.GET_FILES,
  RPC_CHANNELS.skills.DELETE,
  RPC_CHANNELS.skills.OPEN_EDITOR,
  RPC_CHANNELS.skills.OPEN_FINDER,
  RPC_CHANNELS.skills.IMPORT_FROM_CLAUDE,
  RPC_CHANNELS.skills.CREATE,
  RPC_CHANNELS.skills.PROMOTE_TO_AGENT,
] as const

export function registerSkillsHandlers(server: RpcServer, deps: HandlerDeps): void {
  // Get all skills for a workspace (and optionally project-level skills from workingDirectory)
  server.handle(RPC_CHANNELS.skills.GET, async (_ctx, workspaceId: string, workingDirectory?: string) => {
    deps.platform.logger?.info(`SKILLS_GET: Loading skills for workspace: ${workspaceId}${workingDirectory ? `, workingDirectory: ${workingDirectory}` : ''}`)
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      deps.platform.logger?.error(`SKILLS_GET: Workspace not found: ${workspaceId}`)
      return []
    }
    const { loadAllSkills } = await import('@depot/shared/skills')
    const skills = loadAllSkills(workspace.rootPath, workingDirectory)
    deps.platform.logger?.info(`SKILLS_GET: Loaded ${skills.length} skills from ${workspace.rootPath}`)
    return skills
  })

  // Get files in a skill directory
  server.handle(RPC_CHANNELS.skills.GET_FILES, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      deps.platform.logger?.error(`SKILLS_GET_FILES: Workspace not found: ${workspaceId}`)
      return []
    }

    const { getWorkspaceSkillsPath } = await import('@depot/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillDir = join(skillsDir, skillSlug)

    function scanDirectory(dirPath: string): SkillFile[] {
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true })
        return entries
          .filter(entry => !entry.name.startsWith('.')) // Skip hidden files
          .map(entry => {
            const fullPath = join(dirPath, entry.name)
            if (entry.isDirectory()) {
              return {
                name: entry.name,
                type: 'directory' as const,
                children: scanDirectory(fullPath),
              }
            } else {
              const stats = statSync(fullPath)
              return {
                name: entry.name,
                type: 'file' as const,
                size: stats.size,
              }
            }
          })
          .sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
      } catch (err) {
        deps.platform.logger?.error(`SKILLS_GET_FILES: Error scanning ${dirPath}:`, err)
        return []
      }
    }

    return scanDirectory(skillDir)
  })

  // Delete a skill from a workspace
  server.handle(RPC_CHANNELS.skills.DELETE, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const { deleteSkill } = await import('@depot/shared/skills')
    deleteSkill(workspace.rootPath, skillSlug)
    deps.platform.logger?.info(`Deleted skill: ${skillSlug}`)
  })

  // Open skill SKILL.md in editor
  server.handle(RPC_CHANNELS.skills.OPEN_EDITOR, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const { getWorkspaceSkillsPath } = await import('@depot/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillFile = join(skillsDir, skillSlug, 'SKILL.md')
    await deps.platform.openPath?.(skillFile)
  })

  // Open skill folder in Finder/Explorer
  server.handle(RPC_CHANNELS.skills.OPEN_FINDER, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const { getWorkspaceSkillsPath } = await import('@depot/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillDir = join(skillsDir, skillSlug)
    await deps.platform.showItemInFolder?.(skillDir)
  })

  // Import skills from Claude Code (~/.claude/skills/)
  server.handle(RPC_CHANNELS.skills.IMPORT_FROM_CLAUDE, async () => {
    const { importSkillsFromClaudeCode } = await import('@depot/shared/skills')
    const imported = await importSkillsFromClaudeCode()
    deps.platform.logger?.info(`SKILLS_IMPORT: Imported ${imported.length} skills from Claude Code: ${imported.join(', ')}`)
    return imported
  })

  // Create a new skill with template
  server.handle(RPC_CHANNELS.skills.CREATE, async (_ctx, slug: string, name: string, description: string, targetDir?: string) => {
    const { createSkill } = await import('@depot/shared/skills')
    const skillDir = createSkill(slug, name, description, targetDir)
    deps.platform.logger?.info(`SKILLS_CREATE: Created skill "${name}" at ${skillDir}`)
    return skillDir
  })

  // Promote a plain skill to an agent by writing a depot.yaml manifest
  server.handle(RPC_CHANNELS.skills.PROMOTE_TO_AGENT, async (_ctx, workspaceId: string, slug: string, manifest: import('@depot/shared/skills').DepotSkillManifest) => {
    const { loadSkillBySlug, writeDepotManifest } = await import('@depot/shared/skills')
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const skill = loadSkillBySlug(workspace.rootPath, slug)
    if (!skill) throw new Error(`Skill not found: ${slug}`)

    writeDepotManifest(skill.path, manifest)
    deps.platform.logger?.info(`SKILLS_PROMOTE: Promoted skill "${slug}" to agent at ${skill.path}`)
  })
}
