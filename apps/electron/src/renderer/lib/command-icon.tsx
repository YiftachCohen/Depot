/**
 * Resolves a Lucide icon for a quick command — either from an explicit `icon`
 * field or inferred from the command name via keyword matching.
 */
import * as React from 'react'
import {
  Zap, GitPullRequest, Hammer, RefreshCw, FlaskConical, Shield, Rocket, Bug,
  BarChart3, CircleCheck, PackagePlus, AlertTriangle, Server, Search,
  MessageSquare, Eye, FileCode, Settings, Layers, Database, Code2, Bot,
  Wrench, BookOpen, Globe, Terminal, Sparkles, FolderKanban,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export type IconComponent = React.FC<LucideProps>

/** Map of Lucide icon names to components for explicit overrides. */
export const ICON_NAME_MAP: Record<string, IconComponent> = {
  'zap': Zap,
  'git-pull-request': GitPullRequest,
  'hammer': Hammer,
  'refresh-cw': RefreshCw,
  'flask-conical': FlaskConical,
  'shield': Shield,
  'rocket': Rocket,
  'bug': Bug,
  'bar-chart-3': BarChart3,
  'circle-check': CircleCheck,
  'package-plus': PackagePlus,
  'alert-triangle': AlertTriangle,
  'server': Server,
  'search': Search,
  'message-square': MessageSquare,
  'eye': Eye,
  'file-code': FileCode,
  'settings': Settings,
  'layers': Layers,
  'database': Database,
  'code-2': Code2,
  'code': Code2,
  'bot': Bot,
  'wrench': Wrench,
  'book-open': BookOpen,
  'globe': Globe,
  'terminal': Terminal,
  'sparkles': Sparkles,
  'folder-kanban': FolderKanban,
}

/** Keyword-to-icon rules for auto-inference from command names. */
const KEYWORD_RULES: [string[], IconComponent][] = [
  [['review', 'pr', 'pull'], GitPullRequest],
  [['build', 'feature', 'create'], Hammer],
  [['refactor', 'clean', 'restructure'], RefreshCw],
  [['test', 'coverage', 'spec'], FlaskConical],
  [['security', 'scan', 'audit', 'vulnerab'], Shield],
  [['deploy', 'release', 'ship'], Rocket],
  [['fix', 'bug', 'debug'], Bug],
  [['log', 'analyze', 'monitor', 'metric'], BarChart3],
  [['check', 'status', 'health', 'pipeline'], CircleCheck],
  [['add', 'component', 'endpoint'], PackagePlus],
  [['incident', 'alert', 'page'], AlertTriangle],
  [['infra', 'server', 'cluster'], Server],
  [['search', 'find', 'opportunity'], Search],
  [['chat', 'message', 'conversation'], MessageSquare],
  [['architecture', 'design', 'diagram'], Layers],
  [['database', 'migration', 'schema'], Database],
  [['config', 'setting'], Settings],
  [['inspect', 'observe', 'watch'], Eye],
  [['code', 'commit', 'staged'], FileCode],
]

/**
 * Returns a Lucide icon element for a quick command.
 *
 * Resolution order:
 * 1. Explicit `iconName` (Lucide kebab-case name from depot.yaml `icon` field)
 * 2. Keyword match against the command name
 * 3. Fallback to Zap
 */
export function getCommandIcon(
  commandName: string,
  className?: string,
  iconName?: string,
): React.ReactElement {
  const props = { className: className ?? 'h-3 w-3' }

  // 1. Explicit icon override
  if (iconName) {
    const Icon = ICON_NAME_MAP[iconName]
    if (Icon) return <Icon {...props} />
  }

  // 2. Keyword inference
  const lower = commandName.toLowerCase()
  for (const [keywords, Icon] of KEYWORD_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return <Icon {...props} />
    }
  }

  // 3. Fallback
  return <Zap {...props} />
}

/**
 * Resolves a Lucide icon component by name or keyword inference.
 * Returns the component itself (not a rendered element) for use as `fallbackIcon`.
 *
 * Resolution: explicit name → keyword match → Zap fallback
 */
export function resolveIconComponent(iconName?: string, displayName?: string): IconComponent {
  if (iconName) {
    const Icon = ICON_NAME_MAP[iconName]
    if (Icon) return Icon
  }
  if (displayName) {
    const lower = displayName.toLowerCase()
    for (const [keywords, Icon] of KEYWORD_RULES) {
      if (keywords.some((kw) => lower.includes(kw))) return Icon
    }
  }
  return Zap
}
