import { memo } from 'react'
import { useInboxTotal } from '../api/f1queries'

/** Number of inbox items waiting for a decision; nothing when there is none. */
export const InboxBadge = memo(function InboxBadge() {
  const count = useInboxTotal()
  if (count === 0) return null
  return (
    <span
      className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold text-slate-950 tabular-nums"
      aria-label={`${count} en attente`}
    >
      {count}
    </span>
  )
})
