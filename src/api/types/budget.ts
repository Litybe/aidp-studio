// Budget page: C6/C7 of gamedev-contracts.md, T1 to T6 of PLAN-GAMEDEV.md section 6.

export const ROUTES = ['code', 'art', 'map', 'doc'] as const
export type Route = (typeof ROUTES)[number]

/** One bucket of `GET /api/usage?groupBy=`; `key` depends on the grouping. */
export interface UsageBucket {
  key: string
  label?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreateTokens: number
  totalTokens: number
  estimatedCostUsd: number
  sessions: number
  turns: number
}

export type UsageGroupBy = 'day' | 'route' | 'stage' | 'model' | 'ticket'

export interface UsageResponse {
  from?: string
  to?: string
  groupBy: string
  totals: UsageBucket
  buckets: UsageBucket[]
}

/** `GET /api/pixellab/balance`: the last known balance (raw `get_balance` answer) and when it was seen. */
export interface PixellabBalance {
  balance: Record<string, unknown> | number | null
  recordedAt?: string | null
  minReserve?: number | null
}

/** One item of `GET /api/cost/anomalies` (array, or `{ items }`). */
export interface CostAnomaly {
  kind?: string
  ticketKey?: string
  message: string
  at?: string
}

/**
 * `GET`/`PUT /api/settings/budget` (`TODO/config.yaml`, `budget:`). Keys the page does not know are
 * sent back untouched. Names follow the plan (T3 `per_ticket`, T6 night mode and 7 d stop).
 */
export interface BudgetSettings {
  per_ticket?: Partial<Record<Route, number>>
  night_mode?: boolean
  /** Fraction 0..1 of the 7 d window at which the dispatcher stops. */
  stop_7d?: number
  [key: string]: unknown
}
