import type { QueryKey } from '@tanstack/react-query'
import { queryKeys } from '../api/queries'
import type { BusEvent } from '../api/types'
import type { VisibilitySource } from '../lib/visibility'

/** `type` is exact (`ticket.status`) or a prefix pattern (`ticket.*`); every matching rule applies. */
interface InvalidationRule {
  type: string
  keys: (event: BusEvent) => QueryKey[]
}

const PREFIX_WILDCARD = '.*'

function stringField(data: unknown, field: string): string | null {
  if (typeof data !== 'object' || data === null) return null
  const value = (data as Record<string, unknown>)[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const always =
  (...keys: QueryKey[]) =>
  (): QueryKey[] =>
    keys

/** The flow of the event's `data.key`, when it names one. */
const flowOf = (event: BusEvent): QueryKey[] => {
  const key = stringField(event.data, 'key')
  return key ? [queryKeys.flow(key)] : []
}

/**
 * Bus event type → TanStack Query keys to invalidate (§7.1 of PLAN-GAMEDEV.md).
 * A key invalidates every query it prefixes: `['budget']` covers `['budget', 'dispatcher']`.
 */
export const INVALIDATION_RULES: readonly InvalidationRule[] = [
  { type: 'flow.*', keys: always(queryKeys.flows) },
  { type: 'flow.*', keys: flowOf },
  { type: 'flow.waiting_you', keys: always(queryKeys.inbox) },
  { type: 'flow.ended', keys: always(queryKeys.inbox, queryKeys.tickets) },
  { type: 'ticket.*', keys: always(queryKeys.tickets) },
  { type: 'ticket.status', keys: flowOf },
  { type: 'gateway.rate_limit', keys: always(queryKeys.budget, queryKeys.gatewayStatus) },
  { type: 'dispatcher.*', keys: always(queryKeys.dispatcher, queryKeys.budget) },
  { type: 'session.*', keys: always(queryKeys.sessions, queryKeys.gatewayStatus) },
  { type: 'session.started', keys: always(queryKeys.inbox) },
  { type: 'session.question', keys: always(queryKeys.inbox) },
  { type: 'session.answered', keys: always(queryKeys.inbox) },
  { type: 'session.ended', keys: always(queryKeys.inbox, queryKeys.budget, queryKeys.usage) },
  { type: 'session.queued', keys: always(queryKeys.queue) },
  { type: 'session.dequeued', keys: always(queryKeys.queue) },
  { type: 'sessions.purged', keys: always(queryKeys.sessions, queryKeys.inbox) },
  { type: 'pr.*', keys: always(queryKeys.prs) },
  { type: 'pr.attention', keys: always(queryKeys.inbox) },
  { type: 'pr.attention_read', keys: always(queryKeys.inbox) },
  { type: 'pr.inbox_changed', keys: always(queryKeys.inbox) },
  { type: 'pr.merged', keys: always(queryKeys.tickets) },
  { type: 'automation.*', keys: always(queryKeys.automations, queryKeys.inbox) },
  { type: 'run.*', keys: always(queryKeys.runs) },
  { type: 'run.waiting_gate', keys: always(queryKeys.inbox) },
  { type: 'worktree.*', keys: always(queryKeys.worktrees) },
  { type: 'preset.saved', keys: always(queryKeys.presets) },
]

function matches(pattern: string, type: string): boolean {
  if (pattern.endsWith(PREFIX_WILDCARD)) {
    const prefixWithDot = pattern.slice(0, -1)
    return type.startsWith(prefixWithDot)
  }
  return pattern === type
}

/** Stable identity of a query key, for deduplication. */
export function keyId(key: QueryKey): string {
  return JSON.stringify(key)
}

/** The deduplicated keys an event invalidates; empty for an unknown type (`overflow` included). */
export function keysForEvent(event: BusEvent, rules: readonly InvalidationRule[] = INVALIDATION_RULES): QueryKey[] {
  const byId = new Map<string, QueryKey>()
  for (const rule of rules) {
    if (!matches(rule.type, event.type)) continue
    for (const key of rule.keys(event)) byId.set(keyId(key), key)
  }
  return [...byId.values()]
}

/** Window during which invalidations are gathered before one flush. */
export const INVALIDATION_WINDOW_MS = 300

/**
 * Gathers invalidations into one flush per window, deduplicated by key, so a burst of events
 * costs one refetch per query. While the tab is hidden nothing flushes; the keys wait and are
 * replayed when it shows again.
 */
export class InvalidationBatcher {
  private readonly pending = new Map<string, QueryKey>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly unsubscribeVisibility: () => void

  constructor(
    private readonly flush: (keys: QueryKey[]) => void,
    private readonly visibility: VisibilitySource,
    private readonly windowMs = INVALIDATION_WINDOW_MS,
  ) {
    this.unsubscribeVisibility = visibility.subscribe((hidden) => {
      if (hidden) this.cancelTimer()
      else if (this.pending.size > 0) this.schedule()
    })
  }

  get pendingCount(): number {
    return this.pending.size
  }

  add(keys: readonly QueryKey[]): void {
    for (const key of keys) this.pending.set(keyId(key), key)
    if (this.pending.size > 0 && !this.visibility.isHidden()) this.schedule()
  }

  /** Flushes now what is pending, unless hidden. */
  flushNow(): void {
    this.cancelTimer()
    if (this.visibility.isHidden() || this.pending.size === 0) return
    const keys = [...this.pending.values()]
    this.pending.clear()
    this.flush(keys)
  }

  dispose(): void {
    this.cancelTimer()
    this.unsubscribeVisibility()
    this.pending.clear()
  }

  private schedule(): void {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flushNow()
    }, this.windowMs)
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
