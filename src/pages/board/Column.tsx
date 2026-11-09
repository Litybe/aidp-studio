import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import type { ColumnId, QueueEntry, Ticket } from '../../api/types'
import { DOT_TONE } from '../../components/ui/classes'
import { COLUMN_TONE } from './columns'
import { TicketCard } from './TicketCard'

/** Above this many cards a column renders only the visible ones. */
export const VIRTUALIZE_ABOVE = 50
const CARD_ESTIMATE_PX = 84
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
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-1.5" data-testid="virtual-list">
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
  id: ColumnId
  label: string
  tickets: readonly Ticket[]
  queue: readonly QueueEntry[]
}

/** One state of the board: a tinted header with the count, then the cards (virtualised when many). */
export const Column = memo(function Column({ id, label, tickets, queue }: ColumnProps) {
  const empty = tickets.length === 0
  return (
    <section
      className={`flex min-h-0 w-full shrink-0 snap-start flex-col rounded-card border bg-panel/70 md:w-72 ${empty ? 'border-dashed border-line' : 'border-line'}`}
      aria-label={label}
    >
      <h2 className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink">
        <span aria-hidden="true" className={`size-2 rounded-full ${DOT_TONE[COLUMN_TONE[id]]}`} />
        {label}
        <span className={`ml-auto rounded-full px-1.5 text-[0.6875rem] tabular-nums ${empty ? 'text-ink-faint' : 'bg-raised text-ink-muted'}`}>{tickets.length}</span>
      </h2>
      {tickets.length > VIRTUALIZE_ABOVE ? (
        <VirtualCards tickets={tickets} queue={queue} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-1.5 pt-0">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.key} ticket={ticket} queue={queue} />
          ))}
          {empty ? <p className="py-6 text-center text-xs text-ink-faint">Aucun ticket</p> : null}
        </div>
      )}
    </section>
  )
})
