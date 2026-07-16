import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Atelier empty state — a quiet, composed placeholder for empty lists/sections
 * (icon chip + title + description + optional action). Reusable across modules
 * so every "nothing here yet" reads as intentional, not unfinished.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
