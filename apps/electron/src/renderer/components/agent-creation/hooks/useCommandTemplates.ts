/**
 * useCommandTemplates — auto-generates starter quick commands
 * based on the sources connected to an agent.
 */

import { useMemo } from 'react'
import type { QuickCommand } from '../../../../shared/types'

/** Mapping of source slugs to suggested starter commands. */
const SOURCE_COMMANDS: Record<string, QuickCommand[]> = {
  github: [
    { name: 'Review PR', prompt: 'Review pull request {{pr_url}}', icon: 'git-pull-request', variables: [{ name: 'pr_url', type: 'text', label: 'PR URL', placeholder: 'https://github.com/...' }] },
    { name: 'Check CI', prompt: 'Check CI status for {{repo}}', icon: 'circle-check', variables: [{ name: 'repo', type: 'text', label: 'Repository', placeholder: 'owner/repo' }] },
  ],
  linear: [
    { name: 'Triage Issues', prompt: 'Triage new issues in {{project}}', icon: 'list-checks', variables: [{ name: 'project', type: 'text', label: 'Project', placeholder: 'Project name' }] },
  ],
  slack: [
    { name: 'Summarize Channel', prompt: 'Summarize recent messages in {{channel}}', icon: 'message-square', variables: [{ name: 'channel', type: 'text', label: 'Channel', placeholder: '#general' }] },
  ],
  notion: [
    { name: 'Search Docs', prompt: 'Search for {{query}} in Notion', icon: 'search', variables: [{ name: 'query', type: 'text', label: 'Search query', placeholder: 'What to find...' }] },
  ],
  jira: [
    { name: 'Triage Tickets', prompt: 'Triage unassigned tickets in {{project}}', icon: 'list-checks', variables: [{ name: 'project', type: 'text', label: 'Project key', placeholder: 'PROJ' }] },
  ],
  gmail: [
    { name: 'Summarize Inbox', prompt: 'Summarize unread emails from the last {{hours}} hours', icon: 'mail', variables: [{ name: 'hours', type: 'number', label: 'Hours', placeholder: '24' }] },
  ],
  exa: [
    { name: 'Research Topic', prompt: 'Research {{topic}} and summarize key findings', icon: 'search', variables: [{ name: 'topic', type: 'text', label: 'Topic', placeholder: 'What to research...' }] },
  ],
}

export function useCommandTemplates(
  selectedSourceSlugs: string[],
  templateCommands?: QuickCommand[],
): QuickCommand[] {
  return useMemo(() => {
    // Template commands take priority if they exist
    if (templateCommands && templateCommands.length > 0) {
      return [...templateCommands]
    }

    // Otherwise generate from connected sources
    const commands: QuickCommand[] = []
    const seenNames = new Set<string>()

    for (const slug of selectedSourceSlugs) {
      const sourceCommands = SOURCE_COMMANDS[slug]
      if (!sourceCommands) continue
      for (const cmd of sourceCommands) {
        if (!seenNames.has(cmd.name)) {
          seenNames.add(cmd.name)
          commands.push({ ...cmd })
        }
      }
    }

    return commands
  }, [selectedSourceSlugs, templateCommands])
}
