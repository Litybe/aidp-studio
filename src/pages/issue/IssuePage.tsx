import { Link, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { isNotFound } from '../../api/actions'
import { useFlow, useTicket, useTicketCost, useTicketPr } from '../../api/f1queries'
import type { Ticket } from '../../api/types'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { Pill } from '../../components/ui/Pill'
import { columnOf, COLUMN_TONE, COLUMNS, routeOf, ticketNumber } from '../board/columns'
import { RouteBadge } from '../board/RouteBadge'
import { costLabel, FLOW_PILL } from '../board/TicketCard'
import { IssueActions } from './IssueActions'
import { SessionPanel } from './SessionPanel'
import { ArtifactsTab, AssumptionsTab, JournalTab, ProofsTab } from './tabs'
import { Timeline } from './Timeline'
import { buildTimeline, runIdsOf, sessionOfStep } from './flowTimeline'

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
  flowPr,
  flowStatus,
}: {
  ticket: Ticket
  flowPr: { number: number; url?: string | null } | null
  flowStatus: string | null
}) {
  const cost = useTicketCost(ticket.key).data
  const pr = useTicketPr(ticket.key, true).data
  const prNumber = pr?.number ?? flowPr?.number
  const prUrl = pr?.url ?? flowPr?.url ?? undefined
  const total = costLabel(cost)
  const column = columnOf(ticket)
  const columnLabel = COLUMNS.find((entry) => entry.id === column)?.label
  const flowPill = flowStatus ? FLOW_PILL[flowStatus] : undefined
  const flowActive = flowStatus !== null && ACTIVE_FLOW.has(flowStatus)
  return (
    <header className="rounded-card border border-line bg-card p-4">
      <Link to="/board" className="mb-2 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink-muted">
        <Icon name="chevronLeft" size={12} />
        Board
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <RouteBadge route={routeOf(ticket)} size="md" />
        <h1 className="min-w-0 flex-1 text-xl font-semibold leading-snug tracking-tight text-ink">
          <span className="font-mono text-base text-ink-faint">{ticketNumber(ticket)}</span> {ticket.summary}
        </h1>
        <div className="flex items-center gap-2">
          {ticket.url ? (
            <a href={ticket.url} target="_blank" rel="noreferrer noopener" className="flex size-8 items-center justify-center rounded-md text-ink-faint hover:bg-raised hover:text-ink" aria-label="Ouvrir sur GitHub" title="Ouvrir sur GitHub">
              <Icon name="github" size={16} />
            </a>
          ) : null}
          {flowActive ? null : <LaunchRunButton ticket={ticket} label="Lancer un run…" />}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {column && columnLabel ? (
          <Pill tone={COLUMN_TONE[column]} dot>
            {columnLabel}
          </Pill>
        ) : null}
        {flowPill ? <Pill tone={flowPill.tone}>{flowPill.label}</Pill> : null}
        <span className="font-mono text-ink-faint">{ticket.status}</span>
        {ticket.milestone ? <span>{ticket.milestone.title}</span> : null}
        {prNumber !== undefined ? (
          <span className="flex items-center gap-1">
            <Icon name="merge" size={12} className="text-ink-faint" />
            {prUrl ? (
              <a href={prUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                PR #{prNumber}
              </a>
            ) : (
              `PR #${prNumber}`
            )}
            {pr?.state ? ` · ${pr.state}` : ''}
            {typeof pr?.additions === 'number' ? (
              <>
                {' · '}
                <span className="text-emerald-400">+{pr.additions}</span> <span className="text-rose-400">−{pr.deletions ?? 0}</span>
              </>
            ) : (
              ''
            )}
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
    </header>
  )
}

export default function IssuePage() {
  const { key = '' } = useParams({ strict: false })
  const ticket = useTicket(key)
  const flow = useFlow(key)
  const [tab, setTab] = useState<TabId>('artifacts')
  const flowData = flow.data
  const phases = useMemo(() => (flowData ? buildTimeline(flowData) : []), [flowData])
  const runIds = useMemo(() => runIdsOf(flowData), [flowData])
  const sessionId = flowData ? sessionOfStep(flowData, flowData.current) : null

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
    <div className="mx-auto max-w-6xl space-y-5">
      <Header ticket={ticket.data.ticket} flowPr={flowData?.pr ?? null} flowStatus={flowData?.status ?? null} />
      {flow.isError ? (
        isNotFound(flow.error) ? (
          <p className="text-sm text-ink-faint">Pas de flow actif pour cette issue.</p>
        ) : (
          <p className="text-sm text-rose-400">Flow illisible : {flow.error.message}</p>
        )
      ) : null}
      {flowData ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card title="Actions" icon="bolt">
              <IssueActions flow={flowData} />
            </Card>
            <Card title="Timeline" icon="clock" aside={flowData.def.id}>
              <Timeline phases={phases} current={flowData.current ?? null} />
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Card title="Session" icon="sparkles">
              <SessionPanel sessionId={sessionId} />
            </Card>
            <Card>
              <div role="tablist" className="mb-3 inline-flex rounded-md border border-line bg-canvas p-0.5">
                {TABS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.id}
                    className={`rounded px-3 py-1 text-xs font-medium ${tab === entry.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
                    onClick={() => setTab(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <div>
                {tab === 'artifacts' ? <ArtifactsTab runIds={runIds} /> : null}
                {tab === 'proofs' ? <ProofsTab runIds={runIds} /> : null}
                {tab === 'assumptions' ? <AssumptionsTab runIds={runIds} /> : null}
                {tab === 'journal' ? <JournalTab flowKey={flowData.key} /> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      {ticket.data.body ? (
        <details className="rounded-card border border-line bg-card text-sm text-ink-muted">
          <summary className="cursor-pointer px-4 py-3 font-medium text-ink">Description de l'issue</summary>
          <pre className="whitespace-pre-wrap border-t border-line px-4 py-3 text-xs">{ticket.data.body}</pre>
        </details>
      ) : null}
    </div>
  )
}
