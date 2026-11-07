import { useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { isNotFound } from '../../api/actions'
import { useFlow, useTicket, useTicketCost, useTicketPr } from '../../api/f1queries'
import type { Ticket } from '../../api/types'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import { ROUTE_ICON, routeOf, ticketNumber } from '../board/columns'
import { costLabel } from '../board/TicketCard'
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
  flowActive,
}: {
  ticket: Ticket
  flowPr: { number: number; url?: string | null } | null
  flowActive: boolean
}) {
  const cost = useTicketCost(ticket.key).data
  const pr = useTicketPr(ticket.key, true).data
  const route = ROUTE_ICON[routeOf(ticket)]
  const prNumber = pr?.number ?? flowPr?.number
  const prUrl = pr?.url ?? flowPr?.url ?? undefined
  const total = costLabel(cost)
  return (
    <header className="space-y-1">
      <h1 className="text-lg font-semibold text-slate-100">
        <span className="font-mono text-slate-400">{ticketNumber(ticket)}</span> {ticket.summary}{' '}
        {flowActive ? null : <LaunchRunButton ticket={ticket} label="Lancer un run…" />}
      </h1>
      <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
        <span>{route.label}</span>
        {ticket.milestone ? <span>{ticket.milestone.title}</span> : null}
        <span>{ticket.status}</span>
        {prNumber !== undefined ? (
          <span>
            {prUrl ? (
              <a href={prUrl} target="_blank" rel="noreferrer noopener" className="text-sky-400 underline">
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

  if (ticket.isPending) return <p className="text-slate-500">Chargement…</p>
  if (ticket.isError) {
    return isNotFound(ticket.error) ? (
      <p className="text-slate-400">Issue {key} introuvable.</p>
    ) : (
      <p className="text-red-400">Issue illisible : {ticket.error.message}</p>
    )
  }

  return (
    <section className="max-w-5xl space-y-5">
      <Header
        ticket={ticket.data.ticket}
        flowPr={flowData?.pr ?? null}
        flowActive={flowData ? ACTIVE_FLOW.has(flowData.status) : false}
      />
      {flow.isError ? (
        isNotFound(flow.error) ? (
          <p className="text-sm text-slate-500">Pas de flow actif pour cette issue.</p>
        ) : (
          <p className="text-sm text-red-400">Flow illisible : {flow.error.message}</p>
        )
      ) : null}
      {flowData ? (
        <>
          <IssueActions flow={flowData} />
          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-300">Timeline</h2>
            <Timeline phases={phases} current={flowData.current ?? null} />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-300">Session</h2>
            <SessionPanel sessionId={sessionId} />
          </div>
          <div>
            <div role="tablist" className="mb-2 flex gap-1 border-b border-slate-800">
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
            {tab === 'journal' ? <JournalTab flowKey={flowData.key} /> : null}
          </div>
        </>
      ) : null}
      {ticket.data.body ? (
        <details className="text-sm text-slate-400">
          <summary className="cursor-pointer text-slate-300">Description de l'issue</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{ticket.data.body}</pre>
        </details>
      ) : null}
    </section>
  )
}
