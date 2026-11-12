import { Link } from '@tanstack/react-router'
import { memo, useMemo } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useInbox, useTickets } from '../../api/f1queries'
import { useDispatcherBudget, useLastRateLimit, useProjects } from '../../api/queries'
import type { DispatcherBudget, Ticket } from '../../api/types'
import type { UnityStatus } from '../../api/types/unity'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { Async } from '../../components/Async'
import { Gauge } from '../../components/Gauge'
import { StatusDot } from '../../components/StatusDot'
import { Card } from '../../components/ui/Card'
import { BUTTON, DOT_TONE, type Tone } from '../../components/ui/classes'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon, type IconName } from '../../components/ui/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pill } from '../../components/ui/Pill'
import { gaugeInputs } from '../../lib/gauge'
import { formatDateTime } from '../../lib/format'
import { COLUMN_TONE, ROUTE_ICON, routeOf, ticketNumber } from '../board/columns'
import { ElapsedLabel } from '../board/TicketCard'
import { groupInbox, inboxTotal } from '../inbox/groups'
import { groupRows, GROUPS } from '../inbox/items'
import { ticketLabel, useUnityStatus } from '../unity/queries'
import { pipelineSegments, type Summary, summarize } from './summary'

const NO_TICKETS: never[] = []
const NO_ENTRIES: never[] = []
/** Inbox rows shown on the home page before « Tout voir ». */
export const HOME_INBOX_MAX = 5

const TILE_TONE: Record<Tone, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
  muted: 'text-ink',
  accent: 'text-accent',
  violet: 'text-violet-300',
}

interface TileProps {
  label: string
  value: number
  icon: IconName
  tone: Tone
  to: '/board' | '/inbox'
  hint?: string
}

/** One number that matters, as a link to the page that acts on it. */
const Tile = memo(function Tile({ label, value, icon, tone, to, hint }: TileProps) {
  const quiet = value === 0
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-card border border-line bg-card p-3.5 hover:border-line-strong hover:bg-raised"
      aria-label={`${label} : ${value}`}
    >
      <span className="flex items-center justify-between text-xs text-ink-faint">
        {label}
        <Icon name={icon} size={15} className="text-ink-faint group-hover:text-ink-muted" />
      </span>
      <span className={`text-2xl font-semibold tabular-nums leading-none ${quiet ? 'text-ink-faint' : TILE_TONE[tone]}`}>{value}</span>
      {hint ? <span className="text-[0.6875rem] text-ink-faint">{hint}</span> : null}
    </Link>
  )
})

/** The ten columns as one bar: how the work is spread, at a glance. Static divs, no chart library. */
const Pipeline = memo(function Pipeline({ summary }: { summary: Summary }) {
  const segments = pipelineSegments(summary)
  return (
    <Card title="Pipeline" icon="board" aside={<Link to="/board" className="text-xs text-accent hover:underline">Ouvrir le board</Link>}>
      {segments.length === 0 ? (
        <p className="text-xs text-ink-faint">Aucun ticket visible.</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-raised" role="img" aria-label="Répartition des tickets par colonne">
            {segments.map((segment) => (
              <div key={segment.id} className={`h-full ${DOT_TONE[COLUMN_TONE[segment.id]]}`} style={{ width: `${segment.percent}%` }} title={`${segment.label} : ${segment.count}`} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {segments.map((segment) => (
              <li key={segment.id} className="flex items-center gap-1.5 text-ink-muted">
                <span aria-hidden="true" className={`size-2 rounded-full ${DOT_TONE[COLUMN_TONE[segment.id]]}`} />
                {segment.label}
                <span className="font-semibold text-ink tabular-nums">{segment.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
})

const FLOW_STATUS: Record<string, { label: string; tone: Tone }> = {
  running: { label: 'en cours', tone: 'accent' },
  pausing: { label: 'mise en pause', tone: 'muted' },
  waiting_human: { label: 'décision attendue', tone: 'warn' },
  waiting_external: { label: 'attend un hôte', tone: 'muted' },
}

const ActiveRow = memo(function ActiveRow({ ticket }: { ticket: Ticket }) {
  const flow = ticket.flowSummary
  const pause = useApiAction(() => (flow ? apiPost(routes.flowPause(flow.flowKey)) : Promise.resolve()))
  if (!flow) return null
  const route = ROUTE_ICON[routeOf(ticket)]
  const status = FLOW_STATUS[flow.status] ?? { label: flow.status, tone: 'muted' as Tone }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="w-6 text-center font-mono text-xs text-ink-faint" title={route.label}>
        {route.icon}
      </span>
      <Link to="/issue/$key" params={{ key: ticket.key }} className="min-w-0 flex-1 truncate text-ink hover:text-accent">
        <span className="font-mono text-xs text-ink-faint">{ticketNumber(ticket)}</span> {ticket.summary}
      </Link>
      {flow.stepId ? <span className="font-mono text-xs text-ink-muted">{flow.stepId}</span> : null}
      {flow.startedAt ? (
        <span className="flex items-center gap-1 text-xs text-ink-faint">
          <Icon name="clock" size={12} />
          <ElapsedLabel startedAt={flow.startedAt} />
        </span>
      ) : null}
      <Pill tone={status.tone} dot>
        {status.label}
      </Pill>
      {flow.status === 'running' ? <ActionButton label="Pause du flow" onRun={() => pause.run()} /> : null}
      <FeedbackLine feedback={pause.feedback} />
    </li>
  )
})

const selectBudget = (budget: DispatcherBudget) => budget
const VERDICT: Record<string, { label: string; tone: Tone }> = {
  allow: { label: 'lancements autorisés', tone: 'ok' },
  conservative: { label: 'prudent', tone: 'warn' },
  wait: { label: 'attend une fenêtre', tone: 'warn' },
  paused: { label: 'dispatcher en pause', tone: 'danger' },
  '': { label: 'pas encore de tick', tone: 'muted' },
}

const BudgetCard = memo(function BudgetCard() {
  const budget = useDispatcherBudget(selectBudget)
  const needsHistory = budget.isSuccess && budget.data.live === null
  const history = useLastRateLimit(needsHistory)
  const inputs = gaugeInputs(budget.data, needsHistory ? history.data : null)
  const verdict = budget.data?.verdict
  const paused = verdict?.verdict === 'paused'
  const dispatcher = useApiAction((verb: 'pause' | 'resume') => apiPost(routes.dispatcher(verb)))
  const meaning = VERDICT[verdict?.verdict ?? ''] ?? { label: verdict?.verdict ?? '', tone: 'muted' as Tone }
  return (
    <Card title="Budget" icon="budget" aside={<Link to="/budget" className="text-xs text-accent hover:underline">Détail</Link>}>
      <div className="flex flex-col gap-4">
        <Gauge label="5h" source={inputs.source} large {...inputs.fiveHour} />
        <Gauge label="7j" source={inputs.source} large {...inputs.sevenDay} />
      </div>
      {verdict ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Pill tone={meaning.tone} dot title={verdict.why || undefined}>
            {meaning.label}
          </Pill>
          {verdict.maxLaunches > 0 && !paused ? <span className="text-xs text-ink-faint">{verdict.maxLaunches} lancement{verdict.maxLaunches > 1 ? 's' : ''} max</span> : null}
          <span className="ml-auto">
            <ActionButton label={paused ? 'Reprendre le dispatcher' : 'Pause du dispatcher'} tone={paused ? 'primary' : 'neutral'} onRun={() => dispatcher.run(paused ? 'resume' : 'pause')} />
          </span>
          <FeedbackLine feedback={dispatcher.feedback} />
        </div>
      ) : null}
    </Card>
  )
})

function UnityBody({ status }: { status: UnityStatus }) {
  const compile = status.lastCompile
  const holder = status.lock.held ? status.lock.holder : null
  return (
    <dl className="grid grid-cols-[5.5rem_1fr] gap-y-2 text-xs">
      <dt className="text-ink-faint">Éditeur</dt>
      <dd className="flex items-center gap-2 text-ink">
        <StatusDot tone={status.editor.running ? 'ok' : 'muted'} />
        {status.editor.running ? 'ouvert' : 'fermé'}
      </dd>
      <dt className="text-ink-faint">Verrou</dt>
      <dd className="text-ink">
        {status.lock.held ? (
          holder ? (
            <>
              {ticketLabel(holder.ticketKey)} <span className="text-ink-faint">· {holder.stepId}</span>
            </>
          ) : (
            'pris, détenteur inconnu'
          )
        ) : (
          'libre'
        )}
      </dd>
      <dt className="text-ink-faint">Compile</dt>
      <dd className="flex items-center gap-2 text-ink">
        {compile ? (
          <>
            <StatusDot tone={compile.ok ? 'ok' : 'danger'} />
            {compile.ok ? 'réussie' : `${compile.errors.length} erreur${compile.errors.length > 1 ? 's' : ''}`}
            <span className="text-ink-faint">{formatDateTime(compile.finishedAt)}</span>
          </>
        ) : (
          <span className="text-ink-faint">aucune</span>
        )}
      </dd>
    </dl>
  )
}

const UnityCard = memo(function UnityCard() {
  const query = useUnityStatus()
  return (
    <Card title="Unity" icon="unity" aside={<Link to="/unity" className="text-xs text-accent hover:underline">Détail</Link>}>
      <Async query={query} what="État de l'éditeur Unity">
        {(status) => <UnityBody status={status} />}
      </Async>
    </Card>
  )
})

export default function HomePage() {
  const tickets = useTickets()
  const inbox = useInbox()
  const projects = useProjects().data
  const list = tickets.data ?? NO_TICKETS
  const entries = inbox.data ?? NO_ENTRIES
  const summary = useMemo(() => summarize(list), [list])
  const groups = useMemo(() => groupInbox(entries, list), [entries, list])
  const inboxCount = inboxTotal(groups)
  const rows = useMemo(() => GROUPS.flatMap((group) => groupRows(groups, group.id)).slice(0, HOME_INBOX_MAX), [groups])
  const project = projects?.[0]
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader title="Accueil" subtitle={project ? `${project.name} · ${summary.total} tickets suivis` : `${summary.total} tickets suivis`} />
      {tickets.isError ? <p className="text-rose-400">Tickets illisibles : {tickets.error.message}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="À décider" value={inboxCount} icon="inbox" tone="warn" to="/inbox" hint="merges, questions, blocages" />
        <Tile label="En cours" value={summary.active.length} icon="bolt" tone="accent" to="/board" hint={summary.waiting > 0 ? `${summary.waiting} attend${summary.waiting > 1 ? 'ent' : ''} une décision` : 'flows actifs'} />
        <Tile label="À merger" value={summary.counts.merge} icon="merge" tone="ok" to="/board" hint="PR prêtes" />
        <Tile label="Bloquées" value={summary.counts.blocked + summary.counts.triage} icon="alert" tone="danger" to="/board" hint="bloquées et triage" />
        <Tile label="Prêtes" value={summary.counts.ready + summary.counts.queued} icon="play" tone="muted" to="/board" hint="prêtes et en file" />
      </div>
      <Pipeline summary={summary} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card
            title="À décider"
            icon="inbox"
            label="À décider"
            aside={
              <Link to="/inbox" className="text-xs text-accent hover:underline">
                {inboxCount > HOME_INBOX_MAX ? `Tout voir (${inboxCount})` : 'Inbox'}
              </Link>
            }
          >
            {inbox.isPending ? <p className="text-xs text-ink-faint">Chargement…</p> : null}
            {inbox.isSuccess && inboxCount === 0 ? <EmptyState compact title="Rien n'attend de décision." /> : null}
            {rows.length > 0 ? <ul className="space-y-2">{rows}</ul> : null}
          </Card>
          <Card title="En cours" icon="bolt" label="En cours" aside={`${summary.active.length}`}>
            {tickets.isPending ? <p className="text-xs text-ink-faint">Chargement…</p> : null}
            {tickets.isSuccess && summary.active.length === 0 ? (
              <EmptyState compact icon="play" title="Aucun flow actif.">
                <Link to="/board" className={`${BUTTON} mt-1`}>
                  Lancer depuis le board
                </Link>
              </EmptyState>
            ) : null}
            {summary.active.length > 0 ? <ul className="divide-y divide-line">{summary.active.map((ticket) => <ActiveRow key={ticket.key} ticket={ticket} />)}</ul> : null}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <BudgetCard />
          <UnityCard />
        </div>
      </div>
    </div>
  )
}
