import { lazy, Suspense, useMemo, useState } from 'react'
import { useQueue, useTickets } from '../../api/f1queries'
import type { TicketRoute } from '../../api/types'
import { BUTTON_GHOST, INPUT, SELECT } from '../../components/ui/classes'
import { Icon } from '../../components/ui/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { useIsMobile } from '../../lib/media'
import { activeFilterCount, buildBoard, COLUMNS, filterOptions, type Filters, NO_FILTERS, ROUTE_ICON } from './columns'
import { Column } from './Column'
import { ACTIVE_FLOW } from './TicketCard'
import { Toolbar } from './Toolbar'

/** The phone view is its own chunk: the desktop never loads it. */
const BoardMobile = lazy(() => import('./BoardMobile'))

const NO_QUEUE: never[] = []

function BoardDesktop() {
  const tickets = useTickets()
  const queue = useQueue().data ?? NO_QUEUE
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const data = tickets.data
  const options = useMemo(() => filterOptions(data ?? []), [data])
  const board = useMemo(() => buildBoard(data ?? [], filters), [data, filters])
  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }))
  const shown = COLUMNS.reduce((sum, column) => sum + board[column.id].length, 0)
  const active = data?.filter((ticket) => ticket.flowSummary && ACTIVE_FLOW.has(ticket.flowSummary.status)).length ?? 0
  const filtering = activeFilterCount(filters) + (filters.route ? 1 : 0) > 0

  return (
    <section className="flex h-full flex-col gap-4">
      <PageHeader title="Board" subtitle={data ? `${shown} ticket${shown > 1 ? 's' : ''}${filtering ? ' affichés' : ''} · ${active} flow${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}` : undefined}>
        <Toolbar />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex items-center">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 text-ink-faint" />
          <input
            type="search"
            aria-label="Rechercher"
            placeholder="Titre ou #numéro"
            className={`${INPUT} w-56 pl-8`}
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
        </label>
        <select className={SELECT} aria-label="Filtrer par route" value={filters.route} onChange={(event) => patch({ route: event.target.value as TicketRoute | '' })}>
          <option value="">Toutes les routes</option>
          {(Object.keys(ROUTE_ICON) as TicketRoute[]).map((route) => (
            <option key={route} value={route}>
              {ROUTE_ICON[route].label}
            </option>
          ))}
        </select>
        <select className={SELECT} aria-label="Filtrer par milestone" value={filters.milestone} onChange={(event) => patch({ milestone: event.target.value })}>
          <option value="">Tous les milestones</option>
          {options.milestones.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
        <select className={SELECT} aria-label="Filtrer par label" value={filters.label} onChange={(event) => patch({ label: event.target.value })}>
          <option value="">Tous les labels</option>
          {options.labels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {filtering ? (
          <button type="button" className={BUTTON_GHOST} onClick={() => setFilters(NO_FILTERS)}>
            <Icon name="x" size={12} />
            Effacer les filtres
          </button>
        ) : null}
      </div>
      {tickets.isPending ? <p className="text-ink-faint">Chargement…</p> : null}
      {tickets.isError ? <p className="text-rose-400">Tickets illisibles : {tickets.error.message}</p> : null}
      {data ? (
        <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((column) => (
            <Column key={column.id} id={column.id} label={column.label} tickets={board[column.id]} queue={queue} />
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
