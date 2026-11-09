import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: ReactNode
  hint?: ReactNode
  children?: ReactNode
  compact?: boolean
}

/** A quiet « nothing here » block: an icon, a line, an optional hint or action. */
export function EmptyState({ icon = 'check', title, hint, children, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-card border border-dashed border-line text-center ${compact ? 'gap-1 px-3 py-4' : 'gap-2 px-4 py-8'}`}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-raised text-ink-faint">
        <Icon name={icon} size={18} />
      </span>
      <p className="text-sm text-ink-muted">{title}</p>
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
      {children}
    </div>
  )
}
