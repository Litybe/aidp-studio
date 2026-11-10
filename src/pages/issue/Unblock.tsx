import { apiPost, routes, useApiAction } from '../../api/actions'
import type { FlowRun, Ticket } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { H3 } from '../../components/ui/classes'
import { useTicker } from '../../realtime/context'
import { ticketNumber } from '../board/columns'
import { type FlowFacts, isFlowStuck, recoveryOf, TO_DEV_BODY, TO_TEST_BODY } from './unblockState'

/** The flow of a full flow page, reduced to what the unblock actions look at. */
export function factsOfRun(flow: FlowRun): FlowFacts {
  const current = flow.current ?? null
  return { key: flow.key, status: flow.status, stepId: current, stepStartedAt: current ? flow.steps[current]?.started_at ?? null : null }
}

/** The flow of a board card. */
export function factsOfSummary(ticket: Ticket): FlowFacts | null {
  const flow = ticket.flowSummary
  return flow ? { key: flow.flowKey, status: flow.status, stepId: flow.stepId } : null
}

/** Retry / skip of one step; the skip asks first. */
export function StepActions({ flowKey, stepId }: { flowKey: string; stepId: string }) {
  const post = useApiAction((path: string) => apiPost(path))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton label="Relancer l'étape" tone="primary" icon="refresh" onRun={() => post.run(routes.step(flowKey, stepId, 'retry'))} />
      <ActionButton
        label="Passer l'étape"
        confirm={`Passer l'étape ${stepId} ?`}
        onRun={() => post.run(routes.step(flowKey, stepId, 'skip'))}
      />
      <FeedbackLine feedback={post.feedback} />
    </div>
  )
}

/** Abort the flow, put the ticket back in test or dev. Renders only what the state allows. */
export function RecoveryButtons({ ticket, flow, stuck }: { ticket: Ticket; flow: FlowFacts | null; stuck: boolean }) {
  const recovery = recoveryOf(ticket, flow, stuck)
  const status = useApiAction((body: unknown) => apiPost(routes.ticketStatus(ticket.key), body))
  const abort = useApiAction((key: string) => apiPost(routes.flowAbort(key)))
  const both = useApiAction(async (key: string) => {
    await apiPost(routes.flowAbort(key))
    await apiPost(routes.ticketStatus(ticket.key), TO_TEST_BODY)
  })
  if (!recovery.needed) return null
  const number = ticketNumber(ticket)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {flow && recovery.abortAndTest ? (
        <ActionButton
          label="Annuler le flow et remettre en test"
          tone="primary"
          icon="refresh"
          confirm={`Annuler le flow de ${number} puis le remettre en test ?`}
          onRun={() => both.run(flow.key)}
        />
      ) : null}
      {recovery.resetTicket ? (
        <>
          <ActionButton label="Remettre en test" onRun={() => status.run(TO_TEST_BODY)} />
          <ActionButton label="Remettre en dev" onRun={() => status.run(TO_DEV_BODY)} />
        </>
      ) : null}
      {flow && recovery.abort ? (
        <ActionButton
          label="Annuler le flow"
          tone="danger"
          confirm={`Annuler le flow de ${number} ?`}
          onRun={() => abort.run(flow.key)}
        />
      ) : null}
      <FeedbackLine feedback={both.feedback} />
      <FeedbackLine feedback={status.feedback} />
      <FeedbackLine feedback={abort.feedback} />
    </div>
  )
}

/** What the ticket and its flow allow; re-evaluated each second but only re-renders when a boolean flips. */
export function useRecovery(ticket: Ticket, flow: FlowRun | undefined) {
  const facts = flow ? factsOfRun(flow) : null
  const stuck = useTicker((now) => (facts ? isFlowStuck(facts, now) : false))
  return { facts, stuck, recovery: recoveryOf(ticket, facts, stuck) }
}

/** Top of the flow page: shown only when the ticket is blocked or its flow is failed, escalated, pausing or stuck. */
export function UnblockBlock({ ticket, flow }: { ticket: Ticket; flow: FlowRun | undefined }) {
  const { facts, stuck, recovery } = useRecovery(ticket, flow)
  if (!recovery.needed) return null
  return (
    <section aria-label="Débloquer" className="space-y-2 rounded-md border border-amber-900/60 bg-amber-950/20 p-3">
      <h2 className={H3}>Débloquer</h2>
      <p className="text-xs text-ink-muted">
        Un flow mort empêche le dispatcher de reprendre le ticket tant qu'il existe : annule-le, puis remets le ticket dans la bonne voie.
      </p>
      <RecoveryButtons ticket={ticket} flow={facts} stuck={stuck} />
    </section>
  )
}
