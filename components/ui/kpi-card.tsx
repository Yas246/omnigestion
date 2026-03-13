import * as React from "react"
import { cn } from "@/lib/utils"

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: React.ReactNode
}

export function KpiCard({ variant = 'neutral', className, children, ...props }: KpiCardProps) {
  const variantStyles = {
    primary: {
      background: 'bg-linear-to-br from-primary/5 to-primary/10',
      border: 'border-primary/30',
      shadow: 'shadow-[0_4px_12px_-2px_rgba(198,120,93,0.2)]',
      hover: 'hover:shadow-[0_8px_24px_-4px_rgba(198,120,93,0.25)]',
      glow: 'bg-primary',
    },
    success: {
      background: 'bg-linear-to-br from-[oklch(0.65_0.12_145)]/5 to-[oklch(0.65_0.12_145)]/10',
      border: 'border-[oklch(0.65_0.12_145)]/30',
      shadow: 'shadow-[0_4px_12px_-2px_rgba(103,183,120,0.2)]',
      hover: 'hover:shadow-[0_8px_24px_-4px_rgba(103,183,120,0.25)]',
      glow: 'bg-[oklch(0.65_0.12_145)]',
    },
    warning: {
      background: 'bg-linear-to-br from-[oklch(0.75_0.15_75)]/5 to-[oklch(0.75_0.15_75)]/10',
      border: 'border-[oklch(0.75_0.15_75)]/30',
      shadow: 'shadow-[0_4px_12px_-2px_rgba(245,189,73,0.2)]',
      hover: 'hover:shadow-[0_8px_24px_-4px_rgba(245,189,73,0.25)]',
      glow: 'bg-[oklch(0.75_0.15_75)]',
    },
    danger: {
      background: 'bg-linear-to-br from-destructive/5 to-destructive/10',
      border: 'border-destructive/30',
      shadow: 'shadow-[0_4px_12px_-2px_rgba(225,29,72,0.2)]',
      hover: 'hover:shadow-[0_8px_24px_-4px_rgba(225,29,72,0.25)]',
      glow: 'bg-destructive',
    },
    info: {
      background: 'bg-linear-to-br from-[oklch(0.68_0.10_200)]/5 to-[oklch(0.68_0.10_200)]/10',
      border: 'border-[oklch(0.68_0.10_200)]/30',
      shadow: 'shadow-[0_4px_12px_-2px_rgba(2,132,199,0.2)]',
      hover: 'hover:shadow-[0_8px_24px_-4px_rgba(2,132,199,0.25)]',
      glow: 'bg-[oklch(0.68_0.10_200)]',
    },
    neutral: {
      background: 'bg-linear-to-br from-muted/50 to-muted/30',
      border: 'border-border',
      shadow: 'shadow-sm',
      hover: 'hover:shadow-md',
      glow: 'bg-muted',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-6 transition-all duration-300",
        styles.background,
        styles.border,
        styles.shadow,
        styles.hover,
        className
      )}
      {...props}
    >
      {/* Decorative gradient overlay */}
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2",
        styles.glow
      )} />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

interface KpiCardHeaderProps {
  title: string
  icon: React.ReactNode
  iconVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export function KpiCardHeader({ title, icon, iconVariant = 'neutral' }: KpiCardHeaderProps) {
  const iconStyles = {
    primary: 'text-primary bg-primary/10',
    success: 'text-[oklch(0.65_0.12_145)] bg-[oklch(0.65_0.12_145)]/10',
    warning: 'text-[oklch(0.75_0.15_75)] bg-[oklch(0.75_0.15_75)]/10',
    danger: 'text-destructive bg-destructive/10',
    info: 'text-[oklch(0.68_0.10_200)] bg-[oklch(0.68_0.10_200)]/10',
    neutral: 'text-muted-foreground bg-muted/50',
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 hover:scale-110",
        iconStyles[iconVariant]
      )}>
        {icon}
      </div>
    </div>
  )
}

interface KpiCardValueProps {
  value: string | number
  label?: string
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export function KpiCardValue({ value, label, variant = 'neutral' }: KpiCardValueProps) {
  const valueStyles = {
    primary: 'text-primary',
    success: 'text-[oklch(0.65_0.12_145)]',
    warning: 'text-[oklch(0.75_0.15_75)]',
    danger: 'text-destructive',
    info: 'text-[oklch(0.68_0.10_200)]',
    neutral: 'text-foreground',
  }

  return (
    <div>
      <div className={cn(
        "text-3xl font-bold tracking-tight",
        valueStyles[variant]
      )}>
        {value}
      </div>
      {label && (
        <p className="mt-1 text-xs text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  )
}
