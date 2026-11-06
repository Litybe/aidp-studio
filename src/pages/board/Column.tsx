import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import type { QueueEntry, Ticket } from '../../api/types'
import { TicketCard } from './TicketCard'

/** Above this many cards a column renders only the visible ones. */
export const VIRTUALIZE_ABOVE = 50
const CARD_ESTIMATE_PX = 84
const OVERSCAN = 6
const COLUMN_MAX_HEIGHT = 'calc(100vh - 12rem)'

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
    <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: COLUMN_MAX_HEIGHT }} data-testid="virtual-list">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const ticket = tickets[item.index]
          if (!ticket) return null
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute left-0 top-0 w-full pb-2"
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
  return (
    <section className="flex w-72 shrink-0 flex-col" aria-label={label}>
      <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
        <span className="rounded bg-slate-800 px-1.5 text-slate-300 tabular-nums">{tickets.length}</span>
      </h2>
      {tickets.length > VIRTUALIZE_ABOVE ? (
        <VirtualCards tickets={tickets} queue={queue} />
      ) : (
        <div className="flex flex-col gap-2 overflow-auto" style={{ maxHeight: COLUMN_MAX_HEIGHT }}>
          {tickets.map((ticket) => (
            <TicketCard key={ticket.key} ticket={ticket} queue={queue} />
          ))}
        </div>
      )}
    </section>
  )
})
