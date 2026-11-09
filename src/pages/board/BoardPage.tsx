import { lazy, Suspense, useMemo, useState } from 'react'
import { useQueue, useTickets } from '../../api/f1queries'
import type { ColumnId, TicketRoute } from '../../api/types'
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

/** The board in three blocks: the dev lane, the Unity test lane, then the way out. */
const LANES: readonly { id: string; label: string; columns: readonly ColumnId[] }[] = [
  { id: 'dev', label: 'Voie dev', columns: ['triage', 'ready', 'queued', 'realisation', 'review'] },
  { id: 'test', label: 'Voie test', columns: ['to-test', 'test'] },
  { id: 'out', label: 'Sortie', columns: ['merge', 'blocked', 'done'] },
]
const COLUMN_LABEL = Object.fromEntries(COLUMNS.map((column) => [column.id, column.label])) as Record<ColumnId, string>
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
        <div className="flex min-h-0 flex-1 overflow-x-auto pb-2">
          {LANES.map((lane, index) => (
            <div
              key={lane.id}
              role="group"
              aria-label={lane.label}
              className={`flex min-h-0 shrink-0 flex-col gap-2 ${index > 0 ? 'ml-3 border-l border-line pl-3' : ''}`}
            >
              <h2 className="px-1 text-[0.6875rem] font-semibold tracking-wider text-ink-faint uppercase">{lane.label}</h2>
              <div className="flex min-h-0 flex-1 gap-3">
                {lane.columns.map((id) => (
                  <Column key={id} id={id} label={COLUMN_LABEL[id]} tickets={board[id]} queue={queue} />
                ))}
              </div>
            </div>
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
