import { Link } from '@tanstack/react-router'
import { memo, useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useTicketCost } from '../../api/f1queries'
import type { QueueEntry, Ticket, TicketCost } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { LaunchRunButton } from '../../components/run/LaunchButtons'
import type { Tone } from '../../components/ui/classes'
import { Icon } from '../../components/ui/Icon'
import { Pill } from '../../components/ui/Pill'
import { elapsedLabel, formatTokens, formatUsd } from '../../lib/format'
import { useTicker } from '../../realtime/context'
import { blockedReason, canSendToTest, columnOf, routeOf, ticketNumber } from './columns'
import { RouteBadge } from './RouteBadge'

export const ACTIVE_FLOW = new Set(['running', 'pausing', 'waiting_human', 'waiting_external'])

/** Short label and tone of a flow status worth showing on a card; null for the quiet ones. */
export const FLOW_PILL: Record<string, { label: string; tone: Tone }> = {
  running: { label: 'en cours', tone: 'accent' },
  pausing: { label: 'mise en pause', tone: 'muted' },
  paused: { label: 'en pause', tone: 'muted' },
  waiting_human: { label: 'décision attendue', tone: 'warn' },
  waiting_external: { label: 'attend un hôte', tone: 'muted' },
  failed: { label: 'échec', tone: 'danger' },
  escalated: { label: 'escaladé', tone: 'danger' },
  aborted: { label: 'interrompu', tone: 'danger' },
}

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
  return label ? (
    <span className="flex items-center gap-1" title="Coût">
      <Icon name="budget" size={12} className="text-ink-faint" />
      {label}
    </span>
  ) : null
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
  return label ? <span title="Tours de revue et de test">{label}</span> : null
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
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      {canSendToTest(ticket) && !toTest.feedback.soon ? (
        <ActionButton label="Envoyer en test" tone="primary" icon="unity" onRun={() => toTest.run()} />
      ) : null}
      {column === 'triage' || column === 'blocked' ? (
        <ActionButton
          label="Rendre prête"
          tone="primary"
          icon="check"
          onRun={send(routes.ticketStatus(ticket.key), { status: 'todo', reason: 'rendue prête depuis le front' })}
        />
      ) : null}
      {column === 'ready' || column === 'queued' ? (
        <ActionButton label="Lancer maintenant" tone="primary" icon="play" onRun={send(routes.ticketStart(ticket.key), {})} />
      ) : null}
      {!flowActive && column !== 'done' ? <LaunchRunButton ticket={ticket} /> : null}
      {column === 'queued' ? (
        <ActionButton
          label="Monter en priorité"
          icon="arrowUp"
          onRun={queued ? send(routes.queuePromote(queued.id)) : send(routes.ticketStart(ticket.key), {})}
        />
      ) : null}
      {flowActive && flow ? <ActionButton label="Pause du flow" icon="pause" onRun={send(routes.flowPause(flow.flowKey))} /> : null}
      {flow?.status === 'paused' ? (
        <ActionButton label="Reprendre le flow" tone="primary" icon="play" onRun={send(routes.flowResume(flow.flowKey))} />
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
  const flow = ticket.flowSummary ?? null
  const reason = columnOf(ticket) === 'blocked' ? blockedReason(ticket) : null
  const step = flow?.stepId ?? flow?.phase ?? null
  const pill = flow ? FLOW_PILL[flow.status] : undefined
  const live = flow?.startedAt && ACTIVE_FLOW.has(flow.status)
  return (
    <article
      className={`group rounded-card border bg-card p-2.5 transition-colors hover:border-line-strong ${open ? 'border-line-strong' : 'border-line'}`}
      data-testid={`card-${ticket.key}`}
    >
      <header className="flex items-start gap-2">
        <RouteBadge route={routeOf(ticket)} />
        <Link to="/issue/$key" params={{ key: ticket.key }} className="min-w-0 flex-1 leading-snug text-ink hover:text-accent">
          <span className="font-mono text-xs text-ink-faint">{ticketNumber(ticket)}</span> {ticket.summary}
        </Link>
        <button
          type="button"
          className={`-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-raised hover:text-ink ${open ? 'bg-raised text-ink' : 'opacity-60 group-hover:opacity-100'}`}
          aria-expanded={open}
          aria-label={`Actions ${ticketNumber(ticket)}`}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="dots" size={15} />
        </button>
      </header>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
        {pill ? (
          <Pill tone={pill.tone} dot>
            {pill.label}
          </Pill>
        ) : null}
        {step ? <span className="font-mono text-ink-soft">{step}</span> : null}
        {live && flow.startedAt ? (
          <span className="flex items-center gap-1">
            <Icon name="clock" size={12} className="text-ink-faint" />
            <ElapsedLabel startedAt={flow.startedAt} />
          </span>
        ) : null}
        <CostChip ticketKey={ticket.key} />
        <TurnsChip ticket={ticket} />
        {ticket.milestone ? <span className="text-ink-faint">{ticket.milestone.title}</span> : null}
        {reason ? <Pill tone="warn">{reason}</Pill> : null}
      </div>
      {open ? <CardActions ticket={ticket} queue={queue} /> : null}
    </article>
  )
})
