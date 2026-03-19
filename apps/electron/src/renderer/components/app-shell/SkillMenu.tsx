/**
 * SkillMenu - Shared menu content for skill actions
 *
 * Used by:
 * - SkillsListPanel (dropdown via "..." button, context menu via right-click)
 * - SkillInfoPage (title dropdown menu)
 *
 * Uses MenuComponents context to render with either DropdownMenu or ContextMenu
 * primitives, allowing the same component to work in both scenarios.
 *
 * Provides consistent skill actions:
 * - Open in New Window
 * - Show in file manager
 * - Delete (with confirmation dialog)
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import {
  Trash2,
  FolderOpen,
  AppWindow,
} from 'lucide-react'
import { useMenuComponents } from '@/components/ui/menu-context'
import { getFileManagerName } from '@/lib/platform'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface SkillMenuProps {
  /** Skill slug */
  skillSlug: string
  /** Skill name for display */
  skillName: string
  /** Whether this skill is an agent (has depot.yaml) */
  isAgent?: boolean
  /** Callbacks */
  onOpenInNewWindow: () => void
  onShowInFinder: () => void
  onDelete: () => void
  /** Called to demote agent to plain skill (remove depot.yaml only) */
  onDemote?: () => void
}

const BTN_BASE = 'h-8 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer'

/**
 * SkillMenu - Renders the menu items for skill actions
 * This is the content only, not wrapped in a DropdownMenu or ContextMenu
 */
export function SkillMenu({
  skillSlug,
  skillName,
  isAgent,
  onOpenInNewWindow,
  onShowInFinder,
  onDelete,
  onDemote,
}: SkillMenuProps) {
  // Get menu components from context (works with both DropdownMenu and ContextMenu)
  const { MenuItem, Separator } = useMenuComponents()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteAll = useCallback(() => {
    setDeleteDialogOpen(false)
    onDelete()
  }, [onDelete])

  const handleDemote = useCallback(() => {
    setDeleteDialogOpen(false)
    onDemote?.()
  }, [onDemote])

  return (
    <>
      {/* Open in New Window */}
      <MenuItem onClick={onOpenInNewWindow}>
        <AppWindow className="h-3.5 w-3.5" />
        <span className="flex-1">Open in New Window</span>
      </MenuItem>

      {/* Show in file manager */}
      <MenuItem onClick={onShowInFinder}>
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="flex-1">{`Show in ${getFileManagerName()}`}</span>
      </MenuItem>

      <Separator />

      {/* Delete */}
      <MenuItem onClick={handleDeleteClick} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="flex-1">{isAgent ? 'Delete Agent' : 'Delete Skill'}</span>
      </MenuItem>

      {/* Confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete {skillName}?</DialogTitle>
            <DialogDescription>
              {isAgent && onDemote
                ? 'Choose whether to remove the agent configuration only or delete everything.'
                : 'This will permanently delete the skill and all its files.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            {isAgent && onDemote && (
              <button
                type="button"
                onClick={handleDemote}
                className={cn(BTN_BASE, 'border border-border bg-background hover:bg-foreground/[0.05] text-foreground')}
              >
                Remove Agent Only
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteAll}
              className={cn(BTN_BASE, 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            >
              Delete Everything
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
