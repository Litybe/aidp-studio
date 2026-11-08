import { lazy, Suspense, useMemo, useState } from 'react'
import { useQueue, useTickets } from '../../api/f1queries'
import type { TicketRoute } from '../../api/types'
import { useIsMobile } from '../../lib/media'
import { buildBoard, COLUMNS, filterOptions, type Filters, NO_FILTERS, ROUTE_ICON } from './columns'
import { Column } from './Column'
import { Toolbar } from './Toolbar'

/** The phone view is its own chunk: the desktop never loads it. */
const BoardMobile = lazy(() => import('./BoardMobile'))

const SELECT = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200'
const NO_QUEUE: never[] = []

function BoardDesktop() {
  const tickets = useTickets()
  const queue = useQueue().data ?? NO_QUEUE
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const data = tickets.data
  const options = useMemo(() => filterOptions(data ?? []), [data])
  const board = useMemo(() => buildBoard(data ?? [], filters), [data, filters])
  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }))

  return (
    <section className="flex h-full flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-100">Board</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={SELECT}
            aria-label="Filtrer par route"
            value={filters.route}
            onChange={(event) => patch({ route: event.target.value as TicketRoute | '' })}
          >
            <option value="">Toutes les routes</option>
            {(Object.keys(ROUTE_ICON) as TicketRoute[]).map((route) => (
              <option key={route} value={route}>
                {ROUTE_ICON[route].label}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            aria-label="Filtrer par milestone"
            value={filters.milestone}
            onChange={(event) => patch({ milestone: event.target.value })}
          >
            <option value="">Tous les milestones</option>
            {options.milestones.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            aria-label="Filtrer par label"
            value={filters.label}
            onChange={(event) => patch({ label: event.target.value })}
          >
            <option value="">Tous les labels</option>
            {options.labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <Toolbar />
      {tickets.isPending ? <p className="text-slate-500">Chargement…</p> : null}
      {tickets.isError ? <p className="text-red-400">Tickets illisibles : {tickets.error.message}</p> : null}
      {data ? (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((column) => (
            <Column key={column.id} label={column.label} tickets={board[column.id]} queue={queue} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default function BoardPage() {
  const mobile = useIsMobile()
  return mobile ? (
    <Suspense fallback={null}>
      <BoardMobile />
    </Suspense>
  ) : (
    <BoardDesktop />
  )
}
