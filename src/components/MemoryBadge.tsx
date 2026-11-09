import { memo } from 'react'
import { useProposedCount } from '../pages/memory/queries'

/** Number of memory proposals waiting for approval; nothing when none, or while the daemon has no P6 route. */
export const MemoryBadge = memo(function MemoryBadge({ className = '' }: { className?: string }) {
  const count = useProposedCount().data ?? 0
  if (count === 0) return null
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-px text-[0.6875rem] font-semibold leading-4 text-slate-950 tabular-nums ${className}`}
      aria-label={`${count} propositions de mémoire`}
    >
      {count}
    </span>
  )
})
