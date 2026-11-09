import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useQueue, useTickets } from '../../api/f1queries'
import type { QueueEntry, Ticket, TicketRoute } from '../../api/types'
import { BottomSheet } from '../../components/BottomSheet'
import { StatusIcon } from '../../components/StatusIcon'
import {
  activeFilterCount,
  blockedReason,
  buildBoard,
  columnOf,
  defaultState,
  displayTitle,
  filterOptions,
  groupByState,
  isStateId,
  NO_FILTERS,
  ROUTE_ICON,
  routeOf,
  STATES,
  type Filters,
  type StateId,
  ticketNumber,
} from './columns'
import { VIRTUALIZE_ABOVE } from './Column'
import { ticketIconStatus } from './ticketStatus'
import { ACTIVE_FLOW, CardActions, ElapsedLabel } from './TicketCard'
import { Toolbar } from './Toolbar'

const NO_QUEUE: never[] = []
const ROW_ESTIMATE_PX = 52
const OVERSCAN = 8
const PILL = 'inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap'
const PILL_OFF = 'border-line-strong text-ink-soft'
const PILL_ON = 'border-accent bg-accent-soft text-ink'
const ROUTES: readonly (TicketRoute | '')[] = ['', 'code', 'art', 'map', 'doc']
const TOUCH = 'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded px-2 text-sm'
const PRIMARY = `${TOUCH} border border-sky-700 bg-sky-900/40 text-sky-200`

/** Primary action of a state, shown on the card: Merger (two taps), or Remettre prête when blocked. */
function PrimaryAction({ ticket }: { ticket: Ticket }) {
  const column = columnOf(ticket)
  const flow = ticket.flowSummary ?? null
  const [confirming, setConfirming] = useState(false)
  const merge = useApiAction(() =>
    flow?.stepId ? apiPost(routes.step(flow.flowKey, flow.stepId, 'approve')) : Promise.resolve(),
  )
  const retry = useApiAction(() =>
    apiPost(routes.ticketStatus(ticket.key), { status: 'todo', reason: 'rendue prête depuis le front' }),
  )
  if (column === 'merge' && flow?.stepId) {
    return (
      <button
        type="button"
        className={PRIMARY}
        disabled={merge.feedback.pending}
        onBlur={() => setConfirming(false)}
        onClick={() => (confirming ? merge.run() : setConfirming(true))}
      >
        {confirming ? 'Confirmer ?' : 'Merger'}
      </button>
    )
  }
  if (column === 'blocked' || column === 'triage') {
    return (
      <button type="button" className={PRIMARY} disabled={retry.feedback.pending} onClick={() => retry.run()}>
        Remettre prête
      </button>
    )
  }
  return null
}

const MobileCard = memo(function MobileCard({ ticket, onMenu }: { ticket: Ticket; onMenu: (ticket: Ticket) => void }) {
  const route = ROUTE_ICON[routeOf(ticket)]
  const flow = ticket.flowSummary ?? null
  const reason = columnOf(ticket) === 'blocked' ? blockedReason(ticket) : null
  const step = flow?.stepId ?? flow?.phase ?? null
  return (
    <article className="flex h-[52px] items-center border-b border-line pl-1" data-testid={`card-${ticket.key}`}>
      <Link to="/issue/$key" params={{ key: ticket.key }} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 pr-1">
        <StatusIcon status={ticketIconStatus(ticket)} size={18} />
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-ink">
            <span className="font-mono text-xs text-ink-muted">{ticketNumber(ticket)}</span> {displayTitle(ticket.summary)}
          </span>
          <span className="flex items-center gap-x-2 overflow-hidden text-xs whitespace-nowrap text-ink0">
            <span>{route.label}</span>
            {reason ? <span className="truncate text-st-running">{reason}</span> : null}
            {!reason && step ? <span className="truncate text-ink-soft">{step}</span> : null}
            {!reason && flow?.startedAt && ACTIVE_FLOW.has(flow.status) ? <ElapsedLabel startedAt={flow.startedAt} /> : null}
          </span>
        </span>
      </Link>
      <PrimaryAction ticket={ticket} />
      <button
        type="button"
        className={`${TOUCH} text-ink-muted`}
        aria-label={`Actions ${ticketNumber(ticket)}`}
        onClick={() => onMenu(ticket)}
      >
        ⋯
      </button>
    </article>
  )
})

function VirtualList({ tickets, onMenu }: { tickets: readonly Ticket[]; onMenu: (ticket: Ticket) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns functions that change identity; nothing here is memoised from them.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
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
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MobileCard ticket={ticket} onMenu={onMenu} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const FIELD = 'w-full rounded border border-line bg-canvas px-2 text-sm text-ink-soft'

interface FiltersSheetProps {
  filters: Filters
  options: { milestones: string[]; labels: string[] }
  onChange: (change: Partial<Filters>) => void
  onClose: () => void
}

function FiltersSheet({ filters, options, onChange, onClose }: FiltersSheetProps) {
  return (
    <BottomSheet title="Filtres" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-xs text-ink-muted" role="group" aria-label="Route">
          Route
          <div className="flex flex-wrap gap-2">
            {ROUTES.map((route) => (
              <button
                key={route || 'all'}
                type="button"
                aria-pressed={filters.route === route}
                className={`${PILL} ${filters.route === route ? PILL_ON : PILL_OFF}`}
                onClick={() => onChange({ route })}
              >
                {route ? ROUTE_ICON[route].label : 'Tout'}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Recherche
          <input
            type="search"
            className={FIELD}
            value={filters.query}
            placeholder="Titre ou #numéro"
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Milestone
          <select className={FIELD} value={filters.milestone} onChange={(event) => onChange({ milestone: event.target.value })}>
            <option value="">Tous les milestones</option>
            {options.milestones.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Label
          <select className={FIELD} value={filters.label} onChange={(event) => onChange({ label: event.target.value })}>
            <option value="">Tous les labels</option>
            {options.labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded border border-line-strong text-ink-soft"
            onClick={() => onChange({ route: '', milestone: '', label: '', query: '' })}
          >
            Effacer
          </button>
          <button type="button" className="flex-1 rounded border border-sky-700 bg-sky-900/40 text-sky-200" onClick={onClose}>
            Voir les tickets
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default function BoardMobile() {
  const tickets = useTickets()
  const queue = useQueue().data ?? NO_QUEUE
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { s?: unknown }
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sheet, setSheet] = useState<'filters' | 'menu' | null>(null)
  const [cardMenu, setCardMenu] = useState<Ticket | null>(null)
  const data = tickets.data
  const options = useMemo(() => filterOptions(data ?? []), [data])
  const grouped = useMemo(() => groupByState(buildBoard(data ?? [], filters)), [data, filters])
  const active: StateId = isStateId(search.s) ? search.s : defaultState(grouped)
  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }))
  // The state lives in the URL (`?s=`), one history entry per choice, so Back returns to the previous one.
  const chooseState = (id: StateId) =>
    void navigate({ to: '.', search: ((previous: Record<string, unknown>) => ({ ...previous, s: id })) as never })
  const filterCount = activeFilterCount(filters) + (filters.route ? 1 : 0)
  const list = grouped[active]
  const shown = STATES.filter((state) => state.id === active || grouped[state.id].length > 0)
  // The strip scrolls sideways: the state on screen must stay visible in it.
  const activePill = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activePill.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [active])

  return (
    <section className="flex h-full flex-col gap-2">
      <h1 className="sr-only">Board</h1>
      <div className="-mx-3 -mt-3 flex shrink-0 items-center gap-1 border-b border-line bg-canvas px-3 py-1.5">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="État">
          {shown.map((state) => (
            <button
              key={state.id}
              ref={state.id === active ? activePill : undefined}
              type="button"
              aria-pressed={state.id === active}
              className={`${PILL} ${state.id === active ? PILL_ON : PILL_OFF}`}
              onClick={() => chooseState(state.id)}
            >
              {state.label} <span className="tabular-nums">{grouped[state.id].length}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`${PILL} ${filterCount ? PILL_ON : PILL_OFF}`} onClick={() => setSheet('filters')}>
          Filtres{filterCount ? ` ${filterCount}` : ''}
        </button>
        <button type="button" className={`${TOUCH} text-ink-soft`} aria-label="Actions du board" onClick={() => setSheet('menu')}>
          ⋯
        </button>
      </div>
      {tickets.isPending ? <p className="text-ink0">Chargement…</p> : null}
      {tickets.isError ? <p className="text-rose-400">Tickets illisibles : {tickets.error.message}</p> : null}
      {data ? (
        list.length > VIRTUALIZE_ABOVE ? (
          <VirtualList key={active} tickets={list} onMenu={setCardMenu} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {list.map((ticket) => (
              <MobileCard key={ticket.key} ticket={ticket} onMenu={setCardMenu} />
            ))}
            {list.length === 0 ? <p className="px-1 text-ink0">Aucun ticket.</p> : null}
          </div>
        )
      ) : null}
      {sheet === 'filters' ? (
        <FiltersSheet filters={filters} options={options} onChange={patch} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'menu' ? (
        <BottomSheet title="Actions du board" onClose={() => setSheet(null)}>
          <Toolbar withNewRun />
        </BottomSheet>
      ) : null}
      {cardMenu ? (
        <BottomSheet title={`${ticketNumber(cardMenu)} ${cardMenu.summary}`} onClose={() => setCardMenu(null)}>
          <CardActions ticket={cardMenu} queue={queue as readonly QueueEntry[]} />
        </BottomSheet>
      ) : null}
    </section>
  )
}
