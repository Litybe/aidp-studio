import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useSession } from '../../api/f1queries'
import type { FlowDecision, InboxEntry, InboxGroups, Ticket } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import type { Tone } from '../../components/ui/classes'
import { Icon, type IconName } from '../../components/ui/Icon'
import { Pill } from '../../components/ui/Pill'
import { blockedReason, ticketNumber } from '../board/columns'
import { QuestionForm } from '../issue/SessionPanel'

export type GroupId = keyof InboxGroups

export interface GroupDef {
  id: GroupId
  title: string
  icon: IconName
  tone: Tone
}

/** The groups of the page, most urgent first; the Home page shows the first items in this order. */
export const GROUPS: readonly GroupDef[] = [
  { id: 'merges', title: 'Merges à valider', icon: 'merge', tone: 'accent' },
  { id: 'questions', title: 'Questions de session', icon: 'sparkles', tone: 'warn' },
  { id: 'budget', title: 'Dépassements de budget', icon: 'budget', tone: 'danger' },
  { id: 'decisions', title: 'Décisions de flow', icon: 'bolt', tone: 'violet' },
  { id: 'blocked', title: 'Issues bloquées', icon: 'alert', tone: 'warn' },
  { id: 'others', title: 'À consulter', icon: 'inbox', tone: 'muted' },
]

const ITEM_BORDER: Record<Tone, string> = {
  ok: 'border-l-emerald-500',
  warn: 'border-l-amber-400',
  danger: 'border-l-rose-500',
  muted: 'border-l-slate-600',
  accent: 'border-l-sky-500',
  violet: 'border-l-violet-500',
}

/** One inbox row: a card with a coloured left edge, the text on the left and the actions on the right. */
export function Item({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <li className={`rounded-card border border-line border-l-[3px] bg-card p-3 ${ITEM_BORDER[tone]}`}>{children}</li>
}

export function DecisionItem({ decision, approve, reject, tone }: { decision: FlowDecision; approve: string; reject?: string; tone: Tone }) {
  const post = useApiAction((verb: 'approve' | 'reject') => apiPost(routes.step(decision.key, decision.stepId, verb)))
  return (
    <Item tone={tone}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link to="/issue/$key" params={{ key: decision.key }} className="font-medium text-ink hover:text-accent">
            {decision.entry.title}
          </Link>
          <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-faint">
            {decision.key} / {decision.stepId}
          </p>
        </div>
        <span className="flex gap-1.5">
          <ActionButton label={approve} tone="primary" onRun={() => post.run('approve')} />
          {reject ? <ActionButton label={reject} tone="danger" confirm={`${reject} ${decision.key} ?`} onRun={() => post.run('reject')} /> : null}
        </span>
      </div>
      <FeedbackLine feedback={post.feedback} />
    </Item>
  )
}

export function QuestionItem({ entry }: { entry: InboxEntry }) {
  const session = useSession(entry.sessionId ?? null).data
  const questions = session?.pendingQuestion?.questions
  return (
    <Item tone="warn">
      <p className="font-medium text-ink">{entry.title}</p>
      {entry.detail ? <p className="mt-0.5 text-xs text-ink-faint">{entry.detail}</p> : null}
      {entry.sessionId && questions ? (
        <div className="mt-2">
          <QuestionForm sessionId={entry.sessionId} questions={questions} />
        </div>
      ) : null}
    </Item>
  )
}

export function BlockedItem({ ticket }: { ticket: Ticket }) {
  const post = useApiAction(() => apiPost(routes.ticketStatus(ticket.key), { status: 'todo', reason: 'débloquée depuis l’Inbox' }))
  const reason = blockedReason(ticket)
  return (
    <Item tone="warn">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link to="/issue/$key" params={{ key: ticket.key }} className="font-medium text-ink hover:text-accent">
            <span className="font-mono text-xs text-ink-faint">{ticketNumber(ticket)}</span> {ticket.summary}
          </Link>
          {reason ? (
            <p className="mt-1">
              <Pill tone="warn">{reason}</Pill>
            </p>
          ) : null}
        </div>
        <ActionButton label="Remettre prête" tone="primary" onRun={() => post.run()} />
      </div>
      <FeedbackLine feedback={post.feedback} />
    </Item>
  )
}

export function OtherItem({ entry }: { entry: InboxEntry }) {
  return (
    <Item tone="muted">
      <p className="font-medium text-ink">{entry.title}</p>
      {entry.detail ? <p className="mt-0.5 text-xs text-ink-faint">{entry.detail}</p> : null}
    </Item>
  )
}

export const keyOf = (item: FlowDecision) => item.itemId ?? `${item.key}/${item.stepId}`

/** The rows of one group, in its order. */
export function groupRows(groups: InboxGroups, id: GroupId): ReactNode[] {
  switch (id) {
    case 'merges':
      return groups.merges.map((item) => <DecisionItem key={keyOf(item)} decision={item} approve="Merger" tone="accent" />)
    case 'questions':
      return groups.questions.map((entry) => <QuestionItem key={entry.sessionId ?? entry.fingerprint ?? entry.title} entry={entry} />)
    case 'budget':
      return groups.budget.map((item) => <DecisionItem key={keyOf(item)} decision={item} approve="Autoriser" reject="Refuser" tone="danger" />)
    case 'decisions':
      return groups.decisions.map((item) => <DecisionItem key={keyOf(item)} decision={item} approve="Approuver" reject="Rejeter" tone="violet" />)
    case 'blocked':
      return groups.blocked.map((ticket) => <BlockedItem key={ticket.key} ticket={ticket} />)
    case 'others':
      return groups.others.map((entry, index) => <OtherItem key={entry.fingerprint ?? `${entry.kind}-${index}`} entry={entry} />)
  }
}

export function GroupHeading({ group, count }: { group: GroupDef; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon name={group.icon} size={15} className="text-ink-faint" />
      {group.title}
      <span className="rounded-full bg-raised px-1.5 text-[0.6875rem] font-medium text-ink-muted tabular-nums">{count}</span>
    </h2>
  )
}
