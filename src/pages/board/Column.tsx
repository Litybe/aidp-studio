import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import type { QueueEntry, Ticket } from '../../api/types'
import { TicketCard } from './TicketCard'

/** Above this many cards a column renders only the visible ones. */
export const VIRTUALIZE_ABOVE = 50
const CARD_ESTIMATE_PX = 52
const OVERSCAN = 6

function VirtualCards({ tickets, queue }: { tickets: readonly Ticket[]; queue: readonly QueueEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns functions that change identity; nothing here is memoised from them.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ESTIMATE_PX,
    overscan: OVERSCAN,
    getItemKey: (index) => tickets[index]?.key ?? index,
  })
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" data-testid="virtual-list">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const ticket = tickets[item.index]
          if (!ticket) return null
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute left-0 top-0 w-full pb-1.5"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <TicketCard ticket={ticket} queue={queue} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ColumnProps {
  label: string
  tickets: readonly Ticket[]
  queue: readonly QueueEntry[]
}

export const Column = memo(function Column({ label, tickets, queue }: ColumnProps) {
  // An empty column folds into a thin strip: label and zero, no body.
  if (tickets.length === 0) {
    return (
      <section
        className="flex w-9 shrink-0 flex-col items-center gap-2 rounded-md border border-line-soft bg-surface/40 py-2 text-xs text-slate-500"
        aria-label={label}
      >
        <h2 className="[writing-mode:vertical-rl] font-medium tracking-wide uppercase">{label}</h2>
        <span className="tabular-nums">0</span>
      </section>
    )
  }
  return (
    <section className="flex w-60 shrink-0 flex-col" aria-label={label}>
      <h2 className="sticky top-0 z-10 mb-1.5 flex items-center justify-between rounded-md bg-surface px-2 py-1 text-xs font-semibold tracking-wide text-slate-300 uppercase">
        {label}
        <span className="rounded-full bg-slate-800 px-1.5 text-slate-300 tabular-nums">{tickets.length}</span>
      </h2>
      {tickets.length > VIRTUALIZE_ABOVE ? (
        <VirtualCards tickets={tickets} queue={queue} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.key} ticket={ticket} queue={queue} />
          ))}
        </div>
      )}
    </section>
  )
})
