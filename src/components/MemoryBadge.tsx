import { memo } from 'react'
import { useProposedCount } from '../pages/memory/queries'

/** Number of memory proposals waiting for approval; nothing when none, or while the daemon has no P6 route. */
export const MemoryBadge = memo(function MemoryBadge() {
  const count = useProposedCount().data ?? 0
  if (count === 0) return null
  return (
    <span
      className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-xs font-semibold text-slate-950 tabular-nums"
      aria-label={`${count} propositions de mémoire`}
    >
      {count}
    </span>
  )
})
