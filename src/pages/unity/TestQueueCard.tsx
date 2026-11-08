import { apiPost, routes, useApiAction } from '../../api/actions'
import { useQueue, useTickets } from '../../api/f1queries'
import type { QueueEntry, Ticket } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { ticketNumber } from '../board/columns'
import { testQueue } from './testQueue'

const CARD = 'rounded border border-slate-800 bg-slate-900/40 p-4'
const H2 = 'mb-2 text-sm font-semibold text-slate-100'

function Promote({ ticket, queue }: { ticket: Ticket; queue: readonly QueueEntry[] }) {
  const entry = queue.find((item) => item.target === ticket.key)
  const post = useApiAction(() => apiPost(entry ? routes.queuePromote(entry.id) : routes.ticketStart(ticket.key), entry ? undefined : {}))
  return (
    <>
      <ActionButton label="Monter en priorité" onRun={() => post.run()} />
      <FeedbackLine feedback={post.feedback} />
    </>
  )
}

/** « File de test » (C13): the issue under test, then the `to-test` issues in order. Null without data. */
export function TestQueueCard() {
  const tickets = useTickets().data
  const queue = useQueue().data ?? []
  if (!tickets) return null
  const { current, waiting } = testQueue(tickets)
  if (!current && waiting.length === 0) return null
  const step = current ? (current.flowSummary?.stepId ?? current.flowSummary?.phase ?? null) : null
  return (
    <section className={CARD} aria-label="File de test">
      <h2 className={H2}>File de test</h2>
      {current ? (
        <p className="mb-2 flex flex-wrap items-center gap-x-2" data-testid="test-current">
          <span className="text-slate-400">En cours</span>
          <span className="font-mono text-xs">{ticketNumber(current)}</span>
          <span>{current.summary}</span>
          {current.branch ? <span className="font-mono text-xs text-slate-400">{current.branch}</span> : null}
          {step ? <span className="text-xs text-slate-300">étape {step}</span> : null}
        </p>
      ) : (
        <p className="mb-2 text-slate-400">Aucune issue en test.</p>
      )}
      {waiting.length > 0 ? (
        <ol className="flex flex-col gap-1" aria-label="Issues à tester">
          {waiting.map((ticket, index) => (
            <li key={ticket.key} className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-right text-xs text-slate-500">{index + 1}.</span>
              <span className="font-mono text-xs">{ticketNumber(ticket)}</span>
              <span className="min-w-0 flex-1">{ticket.summary}</span>
              {ticket.branch ? <span className="font-mono text-xs text-slate-400">{ticket.branch}</span> : null}
              {index > 0 ? <Promote ticket={ticket} queue={queue} /> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
