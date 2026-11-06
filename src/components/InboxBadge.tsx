import { memo } from 'react'
import { useInboxCount } from '../api/queries'

/** Number of inbox items waiting for a decision; nothing when there is none. */
export const InboxBadge = memo(function InboxBadge() {
  const count = useInboxCount().data ?? 0
  if (count === 0) return null
  return (
    <span
      className="min-w-5 rounded-full bg-sky-600 px-1.5 text-center text-xs font-semibold text-white tabular-nums"
      aria-label={`${count} en attente`}
    >
      {count}
    </span>
  )
})
