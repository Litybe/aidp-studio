import { Link, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { isNotFound } from '../../api/actions'
import { useFlow, useTicket, useTicketCost, useTicketPr } from '../../api/f1queries'
import type { FlowRun, Ticket } from '../../api/types'
import { StatusIcon } from '../../components/StatusIcon'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { Pill } from '../../components/ui/Pill'
import { formatDateTime } from '../../lib/format'
import { FLOW_LABEL, flowIconStatus } from '../../lib/status'
import { COLUMN_TONE, COLUMNS, columnOf, routeOf, ticketNumber } from '../board/columns'
import { RouteBadge } from '../board/RouteBadge'
import { ticketIconStatus } from '../board/ticketStatus'
import { costLabel, FLOW_PILL } from '../board/TicketCard'
import { IssueActions } from './IssueActions'
import { ArtifactsTab, AssumptionsTab, JournalTab, ProofsTab } from './tabs'
import { Duration } from './StepList'
import { GateCard, Timeline } from './Timeline'
import { isMergePending, MergeOverview } from './merge/MergeOverview'
import { runIdsOf } from './flowTimeline'

const ACTIVE_FLOW = new Set(['running', 'pausing', 'waiting_human', 'waiting_external'])

type TabId = 'artifacts' | 'proofs' | 'assumptions' | 'journal'
const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'artifacts', label: 'Artefacts' },
  { id: 'proofs', label: 'Preuves' },
  { id: 'assumptions', label: 'Hypothèses' },
  { id: 'journal', label: 'Journal' },
]

function Header({
  ticket,
  flow,
}: {
  ticket: Ticket
  flow: FlowRun | undefined
}) {
  const cost = useTicketCost(ticket.key).data
  const pr = useTicketPr(ticket.key, true).data
  const flowPr = flow?.pr ?? null
  const flowActive = flow ? ACTIVE_FLOW.has(flow.status) : false
  const prNumber = pr?.number ?? flowPr?.number
  const prUrl = pr?.url ?? flowPr?.url ?? undefined
  const total = costLabel(cost)
  const lane = ticket.phase === 'to-test' || ticket.phase === 'testing' ? 'test' : ticket.phase === 'dev' ? 'dev' : null
  const status = flow ? flowIconStatus(flow.status) : ticketIconStatus(ticket)
  const column = columnOf(ticket)
  const columnLabel = COLUMNS.find((entry) => entry.id === column)?.label
  const flowPill = flow ? FLOW_PILL[flow.status] : undefined
  return (
    <header className="space-y-3 rounded-card border border-line bg-card p-4">
      <Link to="/board" className="-my-2 inline-flex min-h-10 items-center gap-1 text-xs text-ink-faint hover:text-ink-muted">
        <Icon name="chevronLeft" size={12} />
        Board
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <RouteBadge route={routeOf(ticket)} size="md" />
        <h1 className="flex min-w-0 flex-1 basis-60 items-start gap-2 text-xl leading-snug font-semibold tracking-tight text-ink">
          <StatusIcon status={status} size={20} className="mt-1" />
          <span className="min-w-0">
            <span className="font-mono text-base text-ink-faint">{ticketNumber(ticket)}</span> {ticket.summary}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          {ticket.url ? (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex size-10 items-center justify-center rounded-md text-ink-faint hover:bg-raised hover:text-ink"
              aria-label="Ouvrir sur GitHub"
              title="Ouvrir sur GitHub"
            >
              <Icon name="github" size={16} />
            </a>
          ) : null}
          {flowActive ? null : <LaunchRunButton ticket={ticket} label="Lancer un run…" />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
        {column && columnLabel ? (
          <Pill tone={COLUMN_TONE[column]} dot>
            {columnLabel}
          </Pill>
        ) : null}
        {flowPill ? <Pill tone={flowPill.tone}>{flowPill.label}</Pill> : null}
        {flow ? <span className="font-mono text-ink-soft">{flow.def.id}</span> : null}
        {flow ? <span>{FLOW_LABEL[flow.status] ?? flow.status}</span> : <span className="font-mono text-ink-faint">{ticket.status}</span>}
        {lane ? <span className="rounded border border-line px-1.5">{`voie ${lane}`}</span> : null}
        {flow?.started_at ? (
          <span>
            <Duration start={flow.started_at} end={flow.ended_at} />
            {` · début ${formatDateTime(flow.started_at)}`}
          </span>
        ) : null}
        {ticket.milestone ? <span>{ticket.milestone.title}</span> : null}
        {prNumber !== undefined ? (
          <span className="flex items-center gap-1">
            <Icon name="merge" size={12} className="text-ink-faint" />
            {prUrl ? (
              <a href={prUrl} target="_blank" rel="noreferrer noopener" className="-my-3 inline-block py-3 text-accent hover:underline">
                PR #{prNumber}
              </a>
            ) : (
              `PR #${prNumber}`
            )}
            {pr?.state ? ` · ${pr.state}` : ''}
            {typeof pr?.additions === 'number' ? ` · +${pr.additions} −${pr.deletions ?? 0}` : ''}
            {typeof pr?.changedFiles === 'number' ? ` · ${pr.changedFiles} fichiers` : ''}
          </span>
        ) : null}
        {total ? (
          <span className="flex items-center gap-1" title="Coût total">
            <Icon name="budget" size={12} className="text-ink-faint" />
            {total}
          </span>
        ) : null}
      </div>
      {flow ? <IssueActions flow={flow} /> : null}
    </header>
  )
}

function FlowDetails({ flow, runIds, showGate }: { flow: FlowRun; runIds: readonly string[]; showGate: boolean }) {
  const [tab, setTab] = useState<TabId>('artifacts')
  return (
    <>
      <Timeline key={flow.key} flow={flow} showGate={showGate} />
      <div>
        <div role="tablist" className="mb-3 inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-canvas p-0.5">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`min-h-10 rounded px-3 text-xs font-medium ${tab === entry.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {tab === 'artifacts' ? <ArtifactsTab runIds={runIds} /> : null}
        {tab === 'proofs' ? <ProofsTab runIds={runIds} /> : null}
        {tab === 'assumptions' ? <AssumptionsTab runIds={runIds} /> : null}
        {tab === 'journal' ? <JournalTab flowKey={flow.key} /> : null}
      </div>
    </>
  )
}

export default function IssuePage() {
  const { key = '' } = useParams({ strict: false })
  const ticket = useTicket(key)
  const flow = useFlow(key)
  const flowData = flow.data
  const runIds = useMemo(() => runIdsOf(flowData), [flowData])

  if (ticket.isPending) return <p className="text-ink-faint">Chargement…</p>
  if (ticket.isError) {
    return isNotFound(ticket.error) ? (
      <div className="mx-auto mt-10 max-w-md">
        <EmptyState icon="alert" title={`Issue ${key} introuvable.`} />
      </div>
    ) : (
      <p className="text-rose-400">Issue illisible : {ticket.error.message}</p>
    )
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <Header ticket={ticket.data.ticket} flow={flowData} />
      {flow.isError ? (
        isNotFound(flow.error) ? (
          <p className="text-sm text-ink-faint">Pas de flow actif pour cette issue.</p>
        ) : (
          <p className="text-sm text-rose-400">Flow illisible : {flow.error.message}</p>
        )
      ) : null}
      {flowData && (isMergePending(flowData) || columnOf(ticket.data.ticket) === 'merge') ? (
        <>
          <GateCard flow={flowData} />
          <MergeOverview ticket={ticket.data.ticket} flow={flowData} body={ticket.data.body} />
          <details className="rounded-card border border-line bg-card">
            <summary className="min-h-10 cursor-pointer px-4 py-2 text-sm font-medium text-ink select-none">
              Déroulé du flow, artefacts et journal
            </summary>
            <div className="p-3">
              <FlowDetails flow={flowData} runIds={runIds} showGate={false} />
            </div>
          </details>
        </>
      ) : flowData ? (
        <FlowDetails flow={flowData} runIds={runIds} showGate />
      ) : null}
      {ticket.data.body ? (
        <details className="rounded-card border border-line bg-card text-sm text-ink-muted">
          <summary className="min-h-10 cursor-pointer px-4 py-2 font-medium text-ink">Description de l'issue</summary>
          <pre className="border-t border-line px-4 py-3 text-xs whitespace-pre-wrap">{ticket.data.body}</pre>
        </details>
      ) : null}
    </section>
  )
}
