import { Link } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useInbox, useSession, useTickets } from '../../api/f1queries'
import type { FlowDecision, InboxEntry, Ticket } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { blockedReason, ticketNumber } from '../board/columns'
import { QuestionForm } from '../issue/SessionPanel'
import { groupInbox, inboxTotal } from './groups'

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-300">
        {title} <span className="text-slate-500">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

const ITEM = 'rounded border border-slate-800 bg-slate-900 p-3'

function DecisionItem({ decision, approve, reject }: { decision: FlowDecision; approve: string; reject?: string }) {
  const post = useApiAction((verb: 'approve' | 'reject') => apiPost(routes.step(decision.key, decision.stepId, verb)))
  return (
    <li className={ITEM}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/issue/$key" params={{ key: decision.key }} className="text-slate-100 hover:text-sky-300">
          {decision.entry.title}
        </Link>
        <span className="font-mono text-xs text-slate-500">
          {decision.key} / {decision.stepId}
        </span>
        <span className="ml-auto flex gap-1">
          <ActionButton label={approve} tone="primary" onRun={() => post.run('approve')} />
          {reject ? (
            <ActionButton
              label={reject}
              tone="danger"
              confirm={`${reject} ${decision.key} ?`}
              onRun={() => post.run('reject')}
            />
          ) : null}
        </span>
      </div>
      <FeedbackLine feedback={post.feedback} />
    </li>
  )
}

function QuestionItem({ entry }: { entry: InboxEntry }) {
  const session = useSession(entry.sessionId ?? null).data
  const questions = session?.pendingQuestion?.questions
  return (
    <li className={ITEM}>
      <p className="text-slate-100">{entry.title}</p>
      {entry.detail ? <p className="text-xs text-slate-500">{entry.detail}</p> : null}
      {entry.sessionId && questions ? <QuestionForm sessionId={entry.sessionId} questions={questions} /> : null}
    </li>
  )
}

function BlockedItem({ ticket }: { ticket: Ticket }) {
  const post = useApiAction(() =>
    apiPost(routes.ticketStatus(ticket.key), { status: 'todo', reason: 'débloquée depuis l’Inbox' }),
  )
  const reason = blockedReason(ticket)
  return (
    <li className={ITEM}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/issue/$key" params={{ key: ticket.key }} className="text-slate-100 hover:text-sky-300">
          <span className="font-mono text-xs text-slate-400">{ticketNumber(ticket)}</span> {ticket.summary}
        </Link>
        {reason ? <span className="text-xs text-amber-400">{reason}</span> : null}
        <span className="ml-auto">
          <ActionButton label="Remettre prête" tone="primary" onRun={() => post.run()} />
        </span>
      </div>
      <FeedbackLine feedback={post.feedback} />
    </li>
  )
}

function OtherItem({ entry }: { entry: InboxEntry }) {
  return (
    <li className={ITEM}>
      <p className="text-slate-100">{entry.title}</p>
      {entry.detail ? <p className="text-xs text-slate-500">{entry.detail}</p> : null}
    </li>
  )
}

export default function InboxPage() {
  const inbox = useInbox()
  const tickets = useTickets()
  const entries = inbox.data
  const list = tickets.data
  const groups = useMemo(() => groupInbox(entries ?? [], list ?? []), [entries, list])
  if (inbox.isPending) return <p className="text-slate-500">Chargement…</p>
  if (inbox.isError) return <p className="text-red-400">Inbox illisible : {inbox.error.message}</p>
  const total = inboxTotal(groups)
  const keyOf = (item: FlowDecision) => item.itemId ?? `${item.key}/${item.stepId}`
  return (
    <section className="max-w-4xl space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">
        Inbox <span className="text-sm text-slate-500">({total})</span>
      </h1>
      {total === 0 ? <p className="text-slate-400">Rien n&apos;attend de décision.</p> : null}
      <Group title="Merges à valider" count={groups.merges.length}>
        {groups.merges.map((item) => (
          <DecisionItem key={keyOf(item)} decision={item} approve="Merger" />
        ))}
      </Group>
      <Group title="Questions de session" count={groups.questions.length}>
        {groups.questions.map((entry) => (
          <QuestionItem key={entry.sessionId ?? entry.fingerprint ?? entry.title} entry={entry} />
        ))}
      </Group>
      <Group title="Dépassements de budget" count={groups.budget.length}>
        {groups.budget.map((item) => (
          <DecisionItem key={keyOf(item)} decision={item} approve="Autoriser" reject="Refuser" />
        ))}
      </Group>
      <Group title="Décisions de flow" count={groups.decisions.length}>
        {groups.decisions.map((item) => (
          <DecisionItem key={keyOf(item)} decision={item} approve="Approuver" reject="Rejeter" />
        ))}
      </Group>
      <Group title="Issues bloquées" count={groups.blocked.length}>
        {groups.blocked.map((ticket) => (
          <BlockedItem key={ticket.key} ticket={ticket} />
        ))}
      </Group>
      <Group title="À consulter" count={groups.others.length}>
        {groups.others.map((entry, index) => (
          <OtherItem key={entry.fingerprint ?? `${entry.kind}-${index}`} entry={entry} />
        ))}
      </Group>
    </section>
  )
}
