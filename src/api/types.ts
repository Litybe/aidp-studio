// Types of the aidp gateway API, written by hand from docs/gateway-api.md (aidp repository).
// Only the routes F0 reads. Later generated from the Rust structs (schemars → JSON Schema → TS).

/** `{"error": "...", "code": "..."}`, the body of every daemon error. */
export interface ApiErrorBody {
  error: string
  code?: string
}

/** One rolling window as `GET /api/gateway/status` and `GET /api/usage/rate-limit` give it. */
export interface RateLimitWindow {
  /** Fraction used, 0..1. */
  utilization: number
  /** UNIX seconds. */
  resetsAt: number
}

/** A rate-limit snapshot (`rateLimit` of the status, items of `GET /api/usage/rate-limit`). */
export interface RateLimitSnapshot {
  status: string
  isUsingOverage: boolean
  fiveHour: RateLimitWindow | null
  sevenDay: RateLimitWindow | null
  /** UNIX milliseconds. */
  observedAt: number
}

/** `GET /api/gateway/status`. */
export interface GatewayStatus {
  uptimeSec: number
  startedAt: string
  sessions: { running: number; queued: number; total: number }
  automations: { enabled: number; total: number }
  hooksEnabled: boolean
  skillRoot: string | null
  aidpBin: string | null
  vault: string | null
  stateDir: string
  rateLimit: RateLimitSnapshot | null
  capabilities?: Record<string, boolean>
}

/** `allow` | `conservative` | `wait` | `paused`, empty before the first budget-aware tick. */
export type BudgetVerdictKind = 'allow' | 'conservative' | 'wait' | 'paused' | ''

/** The persisted verdict of the last dispatcher tick (`BudgetState`). */
export interface BudgetVerdict {
  verdict: BudgetVerdictKind
  maxLaunches: number
  why: string
  utilization5h: number
  utilization7d: number
  limit5h: number
  limit7d: number
  reserve5h: number
  reserve7d: number
  unreflected: number
  /** RFC 3339, or null when no 5 h window is known. */
  resetsAt5h: string | null
  waitWindow: '5h' | '7d' | null
  observedAt: string | null
}

/** A window of the `live` block of `GET /api/dispatcher/budget`: reset as RFC 3339. */
export interface LiveWindow {
  utilization: number
  resetsAt: string
}

export interface LiveRateLimit {
  status: string
  isUsingOverage: boolean
  fiveHour: LiveWindow | null
  sevenDay: LiveWindow | null
  observedAt: string
}

/** `GET /api/dispatcher/budget`. */
export interface DispatcherBudget {
  verdict: BudgetVerdict
  live: LiveRateLimit | null
  reserves: { fiveHour: number; sevenDay: number; learned: boolean }
  unreflected: number
  stats: unknown
}

export type InboxKind =
  | 'gate'
  | 'pr.attention'
  | 'failure'
  | 'skippedAutomation'
  | 'runningSession'
  | 'flow.human'

/** One item of `GET /api/inbox`, most urgent first. */
export interface InboxEntry {
  kind: InboxKind
  action: 'reply' | 'launch' | 'open' | 'dismiss' | 'decide'
  title: string
  detail?: string
  sessionId?: string
  fingerprint?: string
  automationId?: string
  projectId?: string
  projectName?: string
  at: string
  urgency: number
}

/** One registered repository of `GET /api/projects`. */
export interface Project {
  id: string
  name: string
  path: string
  runsCount: number
}

/** One frame of `GET /api/events` (a `Bus` event). `id` grows by one per event. */
export interface BusEvent {
  id: number
  type: string
  ts: number
  data: unknown
}

// Types of the F1 pages, kept in their own files (grouped re-exports).
export * from './types/tickets'
export * from './types/flows'
export * from './types/inbox'
export * from './types/runs'
export * from './types/merge'
export * from './types/doctor'
