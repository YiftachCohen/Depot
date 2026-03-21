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
  GitCompare, FileText, File, ListOrdered, FilePlus, Plus,
  ClipboardCheck, PieChart, Route, ScanSearch, ScrollText, Clock, Activity,
  Siren, Megaphone, FileClock, GanttChart, CalendarRange, ListTree,
  FileBarChart, ShieldAlert, LayoutDashboard, Map, NotebookPen, ListChecks,
  Mail, CalendarCheck, MessageSquareHeart, TrendingUp, Lightbulb, Briefcase,
  Telescope, Swords, Scale,
  Target, PenTool, UserCheck, GraduationCap, HeartHandshake, Presentation,
  Receipt, Building2, Phone, BarChart2, Share2, Layout, Users, Award,
  Calendar, BookMarked, Hash, BarChart, CheckCircle,
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
  'git-compare': GitCompare,
  'file-text': FileText,
  'file': File,
  'list-ordered': ListOrdered,
  'file-plus': FilePlus,
  'plus': Plus,
  'clipboard-check': ClipboardCheck,
  'pie-chart': PieChart,
  'route': Route,
  'scan-search': ScanSearch,
  'scroll-text': ScrollText,
  'clock': Clock,
  'activity': Activity,
  'siren': Siren,
  'megaphone': Megaphone,
  'file-clock': FileClock,
  'gantt-chart': GanttChart,
  'calendar-range': CalendarRange,
  'list-tree': ListTree,
  'file-bar-chart': FileBarChart,
  'shield-alert': ShieldAlert,
  'layout-dashboard': LayoutDashboard,
  'map': Map,
  'notebook-pen': NotebookPen,
  'list-checks': ListChecks,
  'mail': Mail,
  'calendar-check': CalendarCheck,
  'message-square-heart': MessageSquareHeart,
  'trending-up': TrendingUp,
  'lightbulb': Lightbulb,
  'briefcase': Briefcase,
  'telescope': Telescope,
  'swords': Swords,
  'scale': Scale,
  'target': Target,
  'pen-tool': PenTool,
  'user-check': UserCheck,
  'graduation-cap': GraduationCap,
  'heart-handshake': HeartHandshake,
  'presentation': Presentation,
  'receipt': Receipt,
  'building-2': Building2,
  'phone': Phone,
  'bar-chart-2': BarChart2,
  'bar-chart': BarChart,
  'share-2': Share2,
  'layout': Layout,
  'users': Users,
  'award': Award,
  'calendar': Calendar,
  'book-marked': BookMarked,
  'hash': Hash,
  'check-circle': CheckCircle,
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
  [['prospect', 'sales', 'lead', 'account'], Target],
  [['content', 'blog', 'copy', 'write'], PenTool],
  [['hire', 'recruit', 'interview', 'candidate'], UserCheck],
  [['onboard', 'training', 'sop'], GraduationCap],
  [['customer', 'qbr', 'renewal', 'churn'], HeartHandshake],
  [['strategy', 'okr', 'board', 'planning'], Presentation],
  [['expense', 'budget', 'finance', 'forecast'], Receipt],
  [['seo', 'keyword', 'ranking'], Search],
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
  const tokens = lower.split(/\W+/).filter(Boolean)
  for (const [keywords, Icon] of KEYWORD_RULES) {
    if (keywords.some((kw) => tokens.includes(kw) || lower.includes(kw) && kw.length > 3)) {
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
    const tokens = lower.split(/\W+/).filter(Boolean)
    for (const [keywords, Icon] of KEYWORD_RULES) {
      if (keywords.some((kw) => tokens.includes(kw) || lower.includes(kw) && kw.length > 3)) return Icon
    }
  }
  return Zap
}
