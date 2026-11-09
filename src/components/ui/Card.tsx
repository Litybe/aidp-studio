import type { ReactNode } from 'react'
import { CARD, H2 } from './classes'
import { Icon, type IconName } from './Icon'

interface CardProps {
  title?: ReactNode
  icon?: IconName
  /** Right side of the title row: a count, an action. */
  aside?: ReactNode
  className?: string
  /** Forwarded as the section's accessible name (defaults to a plain-text title). */
  label?: string | undefined
  children: ReactNode
}

/** A titled surface; the body is free. Sections keep their `aria-label` so tests and readers find them. */
export function Card({ title, icon, aside, className = '', label, children }: CardProps) {
  const name = label ?? (typeof title === 'string' ? title : undefined)
  return (
    <section className={`${CARD} ${className}`} aria-label={name}>
      {title !== undefined ? (
        <h2 className={H2}>
          {icon ? <Icon name={icon} className="text-ink-faint" /> : null}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {aside !== undefined ? <span className="font-normal text-ink-faint">{aside}</span> : null}
        </h2>
      ) : null}
      {children}
    </section>
  )
}
