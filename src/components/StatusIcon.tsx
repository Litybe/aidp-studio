import { ICON_COLOR, type IconStatus } from '../lib/status'

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/**
 * The one status icon of the app: inline SVG, `currentColor`, no animation (« en cours » is a
 * half-filled amber disc, still). Decorative: the text next to it carries the meaning.
 */
export function StatusIcon({ status, size = 16, className = '' }: { status: IconStatus; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${ICON_COLOR[status]} ${className}`}
      data-status={status}
    >
      {status === 'success' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.8 8.3l2.2 2.2 4.2-4.6" {...STROKE} stroke="#0d1117" strokeWidth={1.8} />
        </>
      ) : null}
      {status === 'failure' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" {...STROKE} stroke="#0d1117" strokeWidth={1.8} />
        </>
      ) : null}
      {status === 'running' ? (
        <>
          <circle cx="8" cy="8" r="6.4" {...STROKE} strokeWidth={1.6} />
          <path d="M8 3.6a4.4 4.4 0 0 0 0 8.8z" fill="currentColor" />
        </>
      ) : null}
      {status === 'pending' ? (
        <>
          <circle cx="8" cy="8" r="6.4" {...STROKE} strokeWidth={1.6} />
          <path d="M8 4.6V8l2.2 1.4" {...STROKE} />
        </>
      ) : null}
      {status === 'skipped' ? (
        <>
          <circle cx="8" cy="8" r="6.4" {...STROKE} strokeWidth={1.6} />
          <path d="M3.9 12.1l8.2-8.2" {...STROKE} />
        </>
      ) : null}
      {status === 'human' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <circle cx="8" cy="8" r="2.2" fill="#0d1117" />
        </>
      ) : null}
    </svg>
  )
}
