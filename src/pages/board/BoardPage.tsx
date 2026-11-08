import { lazy, Suspense, useMemo, useState } from 'react'
import { useQueue, useTickets } from '../../api/f1queries'
import type { ColumnId, TicketRoute } from '../../api/types'
import { useIsMobile } from '../../lib/media'
import { buildBoard, COLUMNS, filterOptions, type Filters, NO_FILTERS, ROUTE_ICON } from './columns'
import { Column } from './Column'
import { Toolbar } from './Toolbar'

/** The phone view is its own chunk: the desktop never loads it. */
const BoardMobile = lazy(() => import('./BoardMobile'))

const SELECT = 'rounded border border-line bg-bg px-2 py-1 text-xs text-slate-200'

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

  return (
    <section className="flex h-full flex-col gap-2">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-surface px-3 py-1.5">
        <h1 className="text-base font-semibold text-slate-100">Board</h1>
        <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="ml-auto">
          <Toolbar />
        </div>
      </header>
      {tickets.isPending ? <p className="text-slate-500">Chargement…</p> : null}
      {tickets.isError ? <p className="text-red-400">Tickets illisibles : {tickets.error.message}</p> : null}
      {data ? (
        <div className="flex min-h-0 flex-1 overflow-x-auto pb-1">
          {LANES.map((lane, index) => (
            <div
              key={lane.id}
              role="group"
              aria-label={lane.label}
              className={`flex min-h-0 shrink-0 flex-col gap-1.5 ${index > 0 ? 'ml-3 border-l border-line pl-3' : ''}`}
            >
              <h2 className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{lane.label}</h2>
              <div className="flex min-h-0 flex-1 gap-2">
                {lane.columns.map((id) => (
                  <Column key={id} label={COLUMN_LABEL[id]} tickets={board[id]} queue={queue} />
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
