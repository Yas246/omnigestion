import * as React from "react"
import { cn } from "@/lib/utils"

type KpiVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * Atelier KPI card — flat tinted surface, a thin top accent rail, and big
 * tabular figures. No blur "glow" blobs (the generic AI fingerprint). One
 * accent color per variant drives the tint, border, rail, icon chip and value.
 */
const variantStyles: Record<
  KpiVariant,
  { tint: string; border: string; rail: string; icon: string; value: string }
> = {
  primary: {
    tint: 'bg-linear-to-br from-primary/[0.05] to-primary/[0.09]',
    border: 'border-primary/20',
    rail: 'bg-primary',
    icon: 'text-primary bg-primary/10',
    value: 'text-primary',
  },
  success: {
    tint: 'bg-linear-to-br from-[oklch(0.65_0.12_145)]/[0.05] to-[oklch(0.65_0.12_145)]/[0.09]',
    border: 'border-[oklch(0.65_0.12_145)]/20',
    rail: 'bg-[oklch(0.65_0.12_145)]',
    icon: 'text-[oklch(0.65_0.12_145)] bg-[oklch(0.65_0.12_145)]/10',
    value: 'text-[oklch(0.65_0.12_145)]',
  },
  warning: {
    tint: 'bg-linear-to-br from-[oklch(0.75_0.15_75)]/[0.05] to-[oklch(0.75_0.15_75)]/[0.09]',
    border: 'border-[oklch(0.75_0.15_75)]/20',
    rail: 'bg-[oklch(0.75_0.15_75)]',
    icon: 'text-[oklch(0.75_0.15_75)] bg-[oklch(0.75_0.15_75)]/10',
    value: 'text-[oklch(0.75_0.15_75)]',
  },
  danger: {
    tint: 'bg-linear-to-br from-destructive/[0.05] to-destructive/[0.09]',
    border: 'border-destructive/20',
    rail: 'bg-destructive',
    icon: 'text-destructive bg-destructive/10',
    value: 'text-destructive',
  },
  info: {
    tint: 'bg-linear-to-br from-[oklch(0.68_0.10_200)]/[0.05] to-[oklch(0.68_0.10_200)]/[0.09]',
    border: 'border-[oklch(0.68_0.10_200)]/20',
    rail: 'bg-[oklch(0.68_0.10_200)]',
    icon: 'text-[oklch(0.68_0.10_200)] bg-[oklch(0.68_0.10_200)]/10',
    value: 'text-[oklch(0.68_0.10_200)]',
  },
  neutral: {
    tint: 'bg-muted/40',
    border: 'border-border',
    rail: 'bg-muted-foreground/40',
    icon: 'text-muted-foreground bg-muted',
    value: 'text-foreground',
  },
}

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: KpiVariant
  children: React.ReactNode
}

export function KpiCard({ variant = 'neutral', className, children, ...props }: KpiCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-6 shadow-sm transition-shadow duration-300 hover:shadow-md",
        styles.tint,
        styles.border,
        className
      )}
      {...props}
    >
      {/* Top accent rail — the Atelier signature on data cards. */}
      <span className={cn("absolute inset-x-0 top-0 h-0.5", styles.rail)} aria-hidden />
      <div className="relative">{children}</div>
    </div>
  )
}

interface KpiCardHeaderProps {
  title: string
  icon: React.ReactNode
  iconVariant?: KpiVariant
}

export function KpiCardHeader({ title, icon, iconVariant = 'neutral' }: KpiCardHeaderProps) {
  const styles = variantStyles[iconVariant]
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-medium tracking-tight text-foreground/80">{title}</h3>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", styles.icon)}>
        {icon}
      </div>
    </div>
  )
}

interface KpiCardValueProps {
  value: string | number
  label?: string
  variant?: KpiVariant
}

export function KpiCardValue({ value, label, variant = 'neutral' }: KpiCardValueProps) {
  const styles = variantStyles[variant]
  return (
    <div>
      <div className={cn("nums text-3xl font-semibold tracking-tight", styles.value)}>{value}</div>
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  )
}
