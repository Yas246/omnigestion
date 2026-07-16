import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Atelier page header — a small-caps eyebrow, a serif title (the app-wide h1
 * rule picks up --font-serif), an optional description, and a right-aligned
 * actions slot. Used at the top of every module page for a consistent
 * editorial rhythm.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-eyebrow text-muted-foreground/70">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}
