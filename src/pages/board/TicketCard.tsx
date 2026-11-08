import { Link } from '@tanstack/react-router'
import { memo, useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useTicketCost } from '../../api/f1queries'
import type { QueueEntry, Ticket, TicketCost } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { StatusIcon } from '../../components/StatusIcon'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import { elapsedLabel, formatTokens, formatUsd } from '../../lib/format'
import { useTicker } from '../../realtime/context'
import { blockedReason, canSendToTest, columnOf, ROUTE_ICON, routeOf, ticketNumber } from './columns'
import { ticketIconStatus } from './ticketStatus'

export const ACTIVE_FLOW = new Set(['running', 'pausing', 'waiting_human', 'waiting_external'])

/** Elapsed time of the running flow; the label changes once a minute, so the card re-renders as rarely. */
export function ElapsedLabel({ startedAt }: { startedAt: string }) {
  const label = useTicker((now) => elapsedLabel(startedAt, null, now))
  return <span>{label}</span>
}

export function costLabel(cost: TicketCost | undefined): string {
  if (!cost) return ''
  if (typeof cost.costUsd === 'number') return formatUsd(cost.costUsd)
  const tokens = cost.totalTokens ?? cost.tokens
  return typeof tokens === 'number' ? formatTokens(tokens) : ''
}

function CostChip({ ticketKey }: { ticketKey: string }) {
  const cost = useTicketCost(ticketKey).data
  const label = costLabel(cost)
  return label ? <span title="Coût">{label}</span> : null
}

/** Review and test rounds: from the cost route when it says, else the flow iteration. */
function turnsLabel(ticket: Ticket, cost: TicketCost | undefined): string {
  const parts: string[] = []
  const review = cost?.reviewTurns
  const test = cost?.testTurns
  if (typeof review === 'number') parts.push(`revue ${review}`)
  if (typeof test === 'number') parts.push(`test ${test}`)
  if (parts.length === 0 && typeof cost?.turns === 'number') parts.push(`${cost.turns} tours`)
  if (parts.length === 0 && (ticket.flowSummary?.iteration ?? 0) > 1) parts.push(`tour ${ticket.flowSummary?.iteration}`)
  return parts.join(' · ')
}

interface CardProps {
  ticket: Ticket
  queue: readonly QueueEntry[]
}

function TurnsChip({ ticket }: { ticket: Ticket }) {
  const cost = useTicketCost(ticket.key).data
  const label = turnsLabel(ticket, cost)
  return label ? <span>{label}</span> : null
}

export function CardActions({ ticket, queue }: CardProps) {
  const column = columnOf(ticket)
  const flow = ticket.flowSummary ?? null
  const flowActive = flow !== null && ACTIVE_FLOW.has(flow.status)
  const queued = queue.find((entry) => entry.target === ticket.key)
  const post = useApiAction((request: { path: string; body?: unknown }) => apiPost(request.path, request.body))
  const send = (path: string, body?: unknown) => () => post.run(body === undefined ? { path } : { path, body })

  const toTest = useApiAction(() =>
    apiPost(routes.ticketStatus(ticket.key), { status: ticket.status, phase: 'to-test', reason: 'envoyée en test depuis le front' }),
  )

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {canSendToTest(ticket) && !toTest.feedback.soon ? (
        <ActionButton label="Envoyer en test" tone="primary" onRun={() => toTest.run()} />
      ) : null}
      {column === 'triage' || column === 'blocked' ? (
        <ActionButton
          label="Rendre prête"
          tone="primary"
          onRun={send(routes.ticketStatus(ticket.key), { status: 'todo', reason: 'rendue prête depuis le front' })}
        />
      ) : null}
      {column === 'ready' || column === 'queued' ? (
        <ActionButton label="Lancer maintenant" tone="primary" onRun={send(routes.ticketStart(ticket.key), {})} />
      ) : null}
      {!flowActive && column !== 'done' ? <LaunchRunButton ticket={ticket} /> : null}
      {column === 'queued' ? (
        <ActionButton
          label="Monter en priorité"
          onRun={queued ? send(routes.queuePromote(queued.id)) : send(routes.ticketStart(ticket.key), {})}
        />
      ) : null}
      {flowActive && flow ? (
        <ActionButton label="Pause du flow" onRun={send(routes.flowPause(flow.flowKey))} />
      ) : null}
      {flow?.status === 'paused' ? (
        <ActionButton label="Reprendre le flow" tone="primary" onRun={send(routes.flowResume(flow.flowKey))} />
      ) : null}
      {flowActive && flow?.stepId ? (
        <ActionButton
          label="Skip l'étape"
          confirm={`Passer l'étape ${flow.stepId} ?`}
          onRun={send(routes.step(flow.flowKey, flow.stepId, 'skip'))}
        />
      ) : null}
      {column !== 'done' ? (
        <ActionButton
          label="Annuler"
          tone="danger"
          confirm={`Annuler ${ticketNumber(ticket)} ?`}
          onRun={send(routes.ticketCancel(ticket.key), {})}
        />
      ) : null}
      <FeedbackLine feedback={post.feedback} />
      <FeedbackLine feedback={toTest.feedback} />
    </div>
  )
}

export const TicketCard = memo(function TicketCard({ ticket, queue }: CardProps) {
  const [open, setOpen] = useState(false)
  const route = ROUTE_ICON[routeOf(ticket)]
  const flow = ticket.flowSummary ?? null
  const reason = columnOf(ticket) === 'blocked' ? blockedReason(ticket) : null
  const step = flow?.stepId ?? null
  const phase = flow?.phase && flow.phase !== step ? flow.phase : null
  return (
    <article className="rounded-md border border-line bg-surface px-2 py-1.5 hover:bg-surface-2" data-testid={`card-${ticket.key}`}>
      <header className="flex items-center gap-1.5">
        <StatusIcon status={ticketIconStatus(ticket)} />
        <Link
          to="/issue/$key"
          params={{ key: ticket.key }}
          className="min-w-0 flex-1 truncate text-slate-100 hover:text-accent"
          title={ticket.summary}
        >
          <span className="font-mono text-xs text-slate-400">{ticketNumber(ticket)}</span> {ticket.summary}
        </Link>
        <button
          type="button"
          className="rounded px-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          aria-expanded={open}
          aria-label={`Actions ${ticketNumber(ticket)}`}
          onClick={() => setOpen((value) => !value)}
        >
          ⋯
        </button>
      </header>
      <p className="mt-0.5 flex items-center gap-x-2 overflow-hidden pl-[22px] text-xs whitespace-nowrap text-slate-500">
        <span className="font-mono" title={route.label} aria-label={`Route ${route.label}`}>
          {route.icon}
        </span>
        {phase ? <span>{phase}</span> : null}
        {step ? <span className="text-slate-300">{step}</span> : null}
        {flow?.startedAt && ACTIVE_FLOW.has(flow.status) ? <ElapsedLabel startedAt={flow.startedAt} /> : null}
        <CostChip ticketKey={ticket.key} />
        <TurnsChip ticket={ticket} />
        {reason ? <span className="truncate text-st-running">{reason}</span> : null}
        {ticket.milestone ? <span className="min-w-0 truncate">{ticket.milestone.title}</span> : null}
      </p>
      {open ? <CardActions ticket={ticket} queue={queue} /> : null}
    </article>
  )
})
