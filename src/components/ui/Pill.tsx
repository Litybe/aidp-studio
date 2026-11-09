import type { ReactNode } from 'react'
import { DOT_TONE, PILL, PILL_TONE, type Tone } from './classes'

interface PillProps {
  tone?: Tone
  /** A small dot before the text. */
  dot?: boolean
  title?: string | undefined
  className?: string
  children: ReactNode
}

/** A small rounded label coloured by tone. */
export function Pill({ tone = 'muted', dot = false, title, className = '', children }: PillProps) {
  return (
    <span className={`${PILL} ${PILL_TONE[tone]} ${className}`} title={title}>
      {dot ? <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT_TONE[tone]}`} /> : null}
      {children}
    </span>
  )
}
