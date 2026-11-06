import { useMemo, useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useQueue, useTickets } from '../../api/f1queries'
import { useDispatcherBudget } from '../../api/queries'
import type { TicketRoute } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { buildBoard, COLUMNS, filterOptions, type Filters, NO_FILTERS, ROUTE_ICON } from './columns'
import { Column } from './Column'

const SELECT = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200'
const NO_QUEUE: never[] = []

const selectPaused = (budget: { verdict: { verdict: string } }) => budget.verdict.verdict === 'paused'

function Toolbar() {
  const paused = useDispatcherBudget(selectPaused).data === true
  const sync = useApiAction(() => apiPost(routes.ticketsSync))
  const dispatcher = useApiAction((verb: 'pause' | 'resume') => apiPost(routes.dispatcher(verb)))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton label="Sync GitHub" onRun={() => sync.run()} />
      <ActionButton
        label={paused ? 'Reprendre le dispatcher' : 'Pause du dispatcher'}
        tone={paused ? 'primary' : 'neutral'}
        onRun={() => dispatcher.run(paused ? 'resume' : 'pause')}
      />
      <FeedbackLine feedback={sync.feedback} />
      <FeedbackLine feedback={dispatcher.feedback} />
    </div>
  )
}

export default function BoardPage() {
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
