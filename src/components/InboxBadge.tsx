import { memo } from 'react'
import { useInboxTotal } from '../api/f1queries'

/** Number of inbox items waiting for a decision; nothing when there is none. */
export const InboxBadge = memo(function InboxBadge({ className = '' }: { className?: string }) {
  const count = useInboxTotal()
  if (count === 0) return null
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-accent-strong px-1.5 py-px text-[0.6875rem] font-semibold leading-4 text-white tabular-nums ${className}`}
      aria-label={`${count} en attente`}
    >
      {count}
    </span>
  )
})
