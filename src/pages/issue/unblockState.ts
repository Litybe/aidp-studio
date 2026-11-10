import type { Ticket } from '../../api/types'
import { columnOf } from '../board/columns'

/** What the unblock actions need to know about a flow, from a `FlowRun` or from a card's `flowSummary`. */
export interface FlowFacts {
  key: string
  status: string
  /** The step the flow is on. */
  stepId: string | null
  /** When that step started, if known (stuck detection). */
  stepStartedAt?: string | null
}

/** A step in one of these states can be retried or skipped by hand. */
export const STEP_UNBLOCKABLE = new Set(['failed', 'escalated', 'waiting_external', 'running'])
/** The flow died and the dispatcher refuses the ticket (`owned-by-flow`) while it exists. */
const DEAD_FLOW = new Set(['failed', 'escalated'])
/** A flow that is neither done nor already aborted can be aborted. */
const ABORTABLE_FLOW = new Set(['running', 'pausing', 'paused', 'waiting_human', 'waiting_external', 'failed', 'escalated'])
const ENDED_FLOW = new Set(['done', 'aborted'])
/** A running step older than this, with no news, is taken for stuck. */
export const STUCK_AFTER_MS = 30 * 60_000

export function isStepUnblockable(flowStatus: string, stepStatus: string | undefined): boolean {
  return !ENDED_FLOW.has(flowStatus) && stepStatus !== undefined && STEP_UNBLOCKABLE.has(stepStatus)
}

export function isFlowStuck(flow: FlowFacts, nowMs: number): boolean {
  if (flow.status !== 'running' && flow.status !== 'waiting_external') return false
  const started = flow.stepStartedAt ? Date.parse(flow.stepStartedAt) : Number.NaN
  return Number.isFinite(started) && nowMs - started > STUCK_AFTER_MS
}

export interface Recovery {
  /** Show the « Débloquer » block. */
  needed: boolean
  abort: boolean
  /** Put the ticket back in test / dev by hand. */
  resetTicket: boolean
  /** Abort the flow then put the ticket back in test. */
  abortAndTest: boolean
}

/** Only the actions that make sense for the current state of the ticket and its flow. */
export function recoveryOf(ticket: Ticket, flow: FlowFacts | null, stuck: boolean): Recovery {
  const blocked = columnOf(ticket) === 'blocked'
  const dead = flow !== null && (DEAD_FLOW.has(flow.status) || flow.status === 'aborted')
  const pausing = flow?.status === 'pausing'
  const needed = blocked || dead || pausing || stuck
  const abortable = flow !== null && ABORTABLE_FLOW.has(flow.status)
  return {
    needed,
    abort: needed && abortable,
    resetTicket: needed,
    abortAndTest: needed && abortable,
  }
}

export function canAbort(flowStatus: string): boolean {
  return ABORTABLE_FLOW.has(flowStatus)
}

export const TO_TEST_BODY = {
  status: 'in-progress',
  phase: 'to-test',
  reason: 'remis en test depuis le studio',
  force: true,
} as const

export const TO_DEV_BODY = {
  status: 'todo',
  phase: 'dev',
  reason: 'remis en dev depuis le studio',
  force: true,
} as const
