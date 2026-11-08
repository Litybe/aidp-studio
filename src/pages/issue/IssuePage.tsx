import { useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { isNotFound } from '../../api/actions'
import { useFlow, useTicket, useTicketCost, useTicketPr } from '../../api/f1queries'
import type { FlowRun, Ticket } from '../../api/types'
import { StatusIcon } from '../../components/StatusIcon'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import { formatDateTime } from '../../lib/format'
import { FLOW_LABEL, flowIconStatus } from '../../lib/status'
import { ROUTE_ICON, routeOf, ticketNumber } from '../board/columns'
import { ticketIconStatus } from '../board/ticketStatus'
import { costLabel } from '../board/TicketCard'
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
  const route = ROUTE_ICON[routeOf(ticket)]
  const flowPr = flow?.pr ?? null
  const flowActive = flow ? ACTIVE_FLOW.has(flow.status) : false
  const prNumber = pr?.number ?? flowPr?.number
  const prUrl = pr?.url ?? flowPr?.url ?? undefined
  const total = costLabel(cost)
  const lane = ticket.phase === 'to-test' || ticket.phase === 'testing' ? 'test' : ticket.phase === 'dev' ? 'dev' : null
  const status = flow ? flowIconStatus(flow.status) : ticketIconStatus(ticket)
  return (
    <header className="space-y-1.5 border-b border-line pb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="flex min-w-0 items-start gap-2 text-lg font-semibold text-slate-100">
          <StatusIcon status={status} size={20} className="mt-1" />
          <span className="min-w-0">
            <span className="font-mono text-slate-400">{ticketNumber(ticket)}</span> {ticket.summary}
          </span>
        </h1>
        {flowActive ? null : <LaunchRunButton ticket={ticket} label="Lancer un run…" />}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
        {flow ? <span className="font-mono text-slate-300">{flow.def.id}</span> : null}
        {flow ? <span>{FLOW_LABEL[flow.status] ?? flow.status}</span> : <span>{ticket.status}</span>}
        {lane ? <span className="rounded border border-line px-1.5">{`voie ${lane}`}</span> : null}
        {flow?.started_at ? (
          <span>
            <Duration start={flow.started_at} end={flow.ended_at} />
            {` · début ${formatDateTime(flow.started_at)}`}
          </span>
        ) : null}
        <span>{route.label}</span>
        {ticket.milestone ? <span>{ticket.milestone.title}</span> : null}
        {prNumber !== undefined ? (
          <span>
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
        {total ? <span title="Coût total">{total}</span> : null}
      </p>
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
        <div role="tablist" className="mb-2 flex gap-1 overflow-x-auto border-b border-slate-800">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`px-3 py-1 text-sm ${tab === entry.id ? 'border-b-2 border-sky-500 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
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

  if (ticket.isPending) return <p className="text-slate-500">Chargement…</p>
  if (ticket.isError) {
    return isNotFound(ticket.error) ? (
      <p className="text-slate-400">Issue {key} introuvable.</p>
    ) : (
      <p className="text-red-400">Issue illisible : {ticket.error.message}</p>
    )
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <Header ticket={ticket.data.ticket} flow={flowData} />
      {flow.isError ? (
        isNotFound(flow.error) ? (
          <p className="text-sm text-slate-500">Pas de flow actif pour cette issue.</p>
        ) : (
          <p className="text-sm text-red-400">Flow illisible : {flow.error.message}</p>
        )
      ) : null}
      {flowData && isMergePending(flowData) ? (
        <>
          <GateCard flow={flowData} />
          <MergeOverview ticket={ticket.data.ticket} flow={flowData} body={ticket.data.body} />
          <details className="rounded-md border border-line">
            <summary className="min-h-10 cursor-pointer px-3 py-2 text-sm text-slate-300 select-none">
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
        <details className="text-sm text-slate-400">
          <summary className="min-h-10 cursor-pointer py-2 text-slate-300">Description de l'issue</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{ticket.data.body}</pre>
        </details>
      ) : null}
    </section>
  )
}
