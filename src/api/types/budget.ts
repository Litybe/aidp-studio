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
  /** Run ids behind a `ticket` bucket; absent for the other groupings. */
  runs?: string[]
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

/** Token ceilings of `budget.per_ticket` (tokens, `0` = no ceiling); `default` covers a ticket without route. */
export type PerTicketBudget = Record<Route | 'default', number>

/** `dispatcher.night` of `TODO/config.yaml`; `start` and `end` are local `HH:MM`. */
export interface NightSettings {
  enabled: boolean
  start: string
  end: string
  heavy_after_reset: boolean
  heavy_window_minutes: number
}

/**
 * `GET /api/settings/budget`: the keys of `TODO/config.yaml`, unchanged (snake_case). Utilizations and
 * reserves are fractions 0..1, `stop_at_7d_percent` a percentage (`85` = 85 %) or `null` when unset.
 */
export interface BudgetSettings {
  budget: {
    max_utilization_5h: number
    max_utilization_7d: number
    reserve_per_run_5h: number
    reserve_per_run_7d: number
    unknown_policy: string
    learn: boolean
    per_ticket: PerTicketBudget
    pixellab: { min_reserve: number; per_ticket: number }
  }
  dispatcher: { slots: number; /** C13: test lane; absent on a daemon that predates it. */ test_slots?: number; stop_at_7d_percent: number | null; night: NightSettings }
}

/** Body of `PUT /api/settings/budget`: any subset of the keys; `stop_at_7d_percent: null` clears the stop. */
export interface BudgetUpdate {
  budget?: {
    per_ticket?: Partial<PerTicketBudget>
    pixellab?: Partial<BudgetSettings['budget']['pixellab']>
  }
  dispatcher?: { slots?: number; test_slots?: number; stop_at_7d_percent?: number | null; night?: Partial<NightSettings> }
}

/** Reply flags of every `PUT /api/settings/*`; the rest of the reply has the shape of the `GET`. */
export interface SaveFlags {
  /** A daemon restart is needed for the change to apply (never, today: the files are reread). */
  reloadRequired: boolean
  /** `false` when the body changed nothing and the file was left alone. */
  changed: boolean
}
