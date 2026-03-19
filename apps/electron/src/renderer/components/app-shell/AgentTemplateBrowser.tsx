/**
 * AgentTemplateBrowser — browse and customize baked-in agent templates.
 *
 * Two-step flow inside a Radix Dialog:
 *   1. Browse: category filter pills, search, grid of template cards
 *   2. Customize: pre-filled form to tweak before creating the agent
 */

import { useState, useMemo, useCallback, useId } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Tag,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { resolveIconComponent, ICON_NAME_MAP } from '@/lib/command-icon'
import { toast } from 'sonner'
import type { AgentTemplate, DepotSkillManifest } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = ['All'] as const

const INPUT_CLS = cn(
  'w-full h-9 px-3 text-sm rounded-md',
  'bg-background border border-border/60',
  'placeholder:text-muted-foreground/60',
  'focus:outline-none focus:ring-1 focus:ring-ring',
)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentTemplateBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: AgentTemplate[]
  onCreateFromTemplate: (templateId: string, overrides?: Partial<DepotSkillManifest> & { slug?: string }) => Promise<void>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentTemplateBrowser({
  open,
  onOpenChange,
  templates,
  onCreateFromTemplate,
}: AgentTemplateBrowserProps) {
  const [step, setStep] = useState<'browse' | 'customize'>('browse')
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [creating, setCreating] = useState(false)

  // Form element IDs for accessibility
  const nameInputId = useId()
  const slugInputId = useId()
  const descriptionInputId = useId()

  // Customize form state
  const [customName, setCustomName] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customIcon, setCustomIcon] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)

  const iconEntries = useMemo(() => Object.entries(ICON_NAME_MAP), [])

  const categories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...Array.from(new Set(templates.map(t => t.category))).sort()],
    [templates],
  )

  // Reset state when dialog opens
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      // Reset state when opening to avoid stale state from previous session
      setStep('browse')
      setSelectedTemplate(null)
      setSearch('')
      setActiveCategory('All')
      setCreating(false)
      setShowIconPicker(false)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  // Filter templates
  const filtered = useMemo(() => {
    let result = templates
    if (activeCategory !== 'All') {
      result = result.filter(t => t.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(t =>
        t.manifest.name.toLowerCase().includes(q) ||
        t.manifest.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q)),
      )
    }
    return result
  }, [templates, activeCategory, search])

  // Select a template → go to customize step
  const handleSelectTemplate = useCallback((template: AgentTemplate) => {
    setSelectedTemplate(template)
    setCustomName(template.manifest.name)
    setCustomSlug(template.id)
    setCustomDescription(template.manifest.description)
    setCustomIcon(template.manifest.icon)
    setStep('customize')
  }, [])

  // Go back to browse
  const handleBack = useCallback(() => {
    setStep('browse')
    setSelectedTemplate(null)
  }, [])

  // Create the agent
  const handleCreate = useCallback(async () => {
    if (!selectedTemplate || creating) return
    setCreating(true)
    try {
      const overrides: Partial<DepotSkillManifest> & { slug?: string } = {}
      if (customSlug !== selectedTemplate.id) overrides.slug = customSlug
      if (customName !== selectedTemplate.manifest.name) overrides.name = customName
      if (customDescription !== selectedTemplate.manifest.description) overrides.description = customDescription
      if (customIcon !== selectedTemplate.manifest.icon) overrides.icon = customIcon

      await onCreateFromTemplate(selectedTemplate.id, Object.keys(overrides).length > 0 ? overrides : undefined)
      toast.success(`Agent "${customName}" created`)
      handleOpenChange(false)
    } catch (err) {
      console.error('Failed to create agent from template:', err)
      toast.error('Failed to create agent')
    } finally {
      setCreating(false)
    }
  }, [selectedTemplate, creating, customSlug, customName, customDescription, customIcon, onCreateFromTemplate, handleOpenChange])

  // Derive slug from name
  const handleNameChange = useCallback((name: string) => {
    setCustomName(name)
    // Auto-derive slug if user hasn't manually edited it or it matches the template default
    if (selectedTemplate && (customSlug === selectedTemplate.id || customSlug === slugify(customName))) {
      setCustomSlug(slugify(name))
    }
  }, [selectedTemplate, customSlug, customName])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] !flex flex-col overflow-hidden p-0 gap-0">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'browse' ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Agent Templates
                  </DialogTitle>
                  <DialogDescription>
                    Pick a template to get started quickly. Customize it to fit your needs.
                  </DialogDescription>
                </DialogHeader>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(INPUT_CLS, 'pl-9')}
                  />
                </div>

                {/* Category pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        'inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-full transition-colors',
                        activeCategory === cat
                          ? 'bg-foreground text-background'
                          : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template grid */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-6 pb-6">
                  {filtered.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {filtered.map((template) => {
                        const IconComp = resolveIconComponent(template.manifest.icon)
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleSelectTemplate(template)}
                            className={cn(
                              'group flex flex-col gap-3 p-4 rounded-xl text-left transition-all',
                              'border border-border/60 bg-foreground/[0.01]',
                              'hover:bg-foreground/[0.04] hover:border-foreground/15 hover:shadow-xs',
                              'cursor-pointer',
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.06] shrink-0">
                                <IconComp className="h-4.5 w-4.5 text-foreground/50" />
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-foreground/15 group-hover:text-foreground/40 transition-colors mt-1" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-[13px] font-medium text-foreground leading-tight">{template.manifest.name}</h4>
                              <p className="text-[11px] text-foreground/50 leading-relaxed line-clamp-2">{template.manifest.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40 bg-foreground/[0.04] px-1.5 py-0.5 rounded">
                                {template.manifest.quick_commands.length} command{template.manifest.quick_commands.length !== 1 ? 's' : ''}
                              </span>
                              {template.tags?.slice(0, 2).map((tag) => (
                                <span key={tag} className="text-[10px] text-foreground/35 bg-foreground/[0.03] px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No templates matching "{search}"
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="customize"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Customize header */}
              <div className="px-6 pt-6 pb-4 space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <DialogHeader className="flex-1">
                    <DialogTitle>Customize Agent</DialogTitle>
                    <DialogDescription>
                      Adjust the details before adding to your workspace.
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              {/* Form */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-6 pb-6 space-y-4">
                  {/* Icon + Name row */}
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <label className="text-[11px] text-foreground/50 mb-1.5 block">Icon</label>
                      <button
                        type="button"
                        onClick={() => setShowIconPicker(v => !v)}
                        className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-lg transition-all cursor-pointer',
                          'border border-border/60 bg-foreground/[0.04] hover:bg-foreground/[0.08] hover:ring-2 hover:ring-foreground/10',
                        )}
                        title="Change icon"
                      >
                        {(() => {
                          const PreviewIcon = resolveIconComponent(customIcon)
                          return <PreviewIcon className="h-4.5 w-4.5 text-muted-foreground" />
                        })()}
                      </button>
                    </div>
                    <div className="flex-1">
                      <label htmlFor={nameInputId} className="text-[11px] text-foreground/50 mb-1.5 block">Name</label>
                      <input
                        id={nameInputId}
                        type="text"
                        value={customName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className={INPUT_CLS}
                        placeholder="Agent name"
                      />
                    </div>
                  </div>

                  {/* Icon picker grid */}
                  {showIconPicker && (
                    <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-2">
                      <div className="grid grid-cols-8 gap-1">
                        {iconEntries.map(([name, Icon]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setCustomIcon(name); setShowIconPicker(false) }}
                            aria-label={`Select icon ${name}`}
                            title={name}
                            className={cn(
                              'flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer',
                              customIcon === name
                                ? 'bg-foreground text-background'
                                : 'hover:bg-foreground/[0.08] text-foreground/70',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slug */}
                  <div>
                    <label htmlFor={slugInputId} className="text-[11px] text-foreground/50 mb-1.5 block">Slug</label>
                    <input
                      id={slugInputId}
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className={INPUT_CLS}
                      placeholder="agent-slug"
                    />
                    <p className="text-[10px] text-foreground/35 mt-1">Directory name in ~/.depot/skills/</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor={descriptionInputId} className="text-[11px] text-foreground/50 mb-1.5 block">Description</label>
                    <textarea
                      id={descriptionInputId}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      rows={2}
                      className={cn(INPUT_CLS, 'h-auto py-2 resize-none')}
                      placeholder="Brief description of what this agent does"
                    />
                  </div>

                  {/* Quick commands preview */}
                  {selectedTemplate && (
                    <div>
                      <label className="text-[11px] text-foreground/50 mb-1.5 block">Quick Commands</label>
                      <div className="space-y-1.5">
                        {selectedTemplate.manifest.quick_commands.map((cmd, i) => {
                          const CmdIcon = resolveIconComponent(cmd.icon)
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border/40 bg-foreground/[0.02]"
                            >
                              <CmdIcon className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-foreground">{cmd.name}</span>
                                <p className="text-[10px] text-foreground/40 truncate">{cmd.prompt}</p>
                              </div>
                              {cmd.variables && cmd.variables.length > 0 && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] text-foreground/35 bg-foreground/[0.04] px-1.5 py-0.5 rounded">
                                  <Tag className="h-2.5 w-2.5" />
                                  {cmd.variables.length} var{cmd.variables.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-foreground/35 mt-1.5">
                        You can edit commands after the agent is created.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  size="sm"
                  disabled={!customName.trim() || !customSlug.trim() || creating}
                  onClick={handleCreate}
                >
                  {creating ? 'Creating...' : 'Add Agent'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
