import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  /** One line under the title: what the page shows, a count, a state. */
  subtitle?: ReactNode
  /** Right side: filters, actions. */
  children?: ReactNode
  className?: string
}

/** The first row of every page: title, optional subtitle, actions on the right. */
export function PageHeader({ title, subtitle, children, className = '' }: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  )
}
