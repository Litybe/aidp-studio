import type { DispatcherBudget, LiveWindow, RateLimitSnapshot, RateLimitWindow } from '../api/types'

export type GaugeLevel = 'ok' | 'warn' | 'danger' | 'unknown'
export type WindowName = 'fiveHour' | 'sevenDay'

/** One window, units normalized: utilization 0..1, reset in ms since epoch. */
export interface GaugeInput {
  utilization: number | null
  resetsAtMs: number | null
  /** Threshold of the dispatcher for this window (0..1). */
  limit: number
}

export interface GaugeModel {
  /** 0..100, rounded; null when unknown or when the window has already reset. */
  percent: number | null
  level: GaugeLevel
  resetsAtMs: number | null
  expired: boolean
}

/** Dispatcher defaults when no budget-aware tick has run yet (`limit5h` / `limit7d` are 0 then). */
export const DEFAULT_LIMITS: Record<WindowName, number> = { fiveHour: 0.8, sevenDay: 0.9 }
/** Below the limit by less than this, the gauge warns. */
export const WARN_MARGIN = 0.15
/** A number below this is UNIX seconds, above it milliseconds. */
const SECONDS_MS_PIVOT = 1e11

/** Reset instant in ms from UNIX seconds, UNIX ms or RFC 3339; null when absent or unreadable. */
export function toResetMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return value < SECONDS_MS_PIVOT ? value * 1000 : value
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function isExpired(resetsAtMs: number | null, nowMs: number): boolean {
  return resetsAtMs !== null && resetsAtMs <= nowMs
}

/** The gauge of one window; `expired` comes from the ticker (see {@link isExpired}). */
export function computeGauge(input: GaugeInput, expired: boolean): GaugeModel {
  const { utilization, resetsAtMs } = input
  if (utilization === null || !Number.isFinite(utilization) || expired) {
    return { percent: null, level: 'unknown', resetsAtMs, expired }
  }
  const limit = input.limit > 0 ? input.limit : 1
  const level: GaugeLevel =
    utilization >= limit ? 'danger' : utilization >= limit - WARN_MARGIN ? 'warn' : 'ok'
  return { percent: Math.round(clamp01(utilization) * 100), level, resetsAtMs, expired }
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** `3 j 4 h`, `2 h 05`, `14 min`, `< 1 min`: changes once a minute at most, so it re-renders little. */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs < MINUTE_MS) return '< 1 min'
  if (remainingMs < HOUR_MS) return `${Math.floor(remainingMs / MINUTE_MS)} min`
  if (remainingMs < DAY_MS) {
    const hours = Math.floor(remainingMs / HOUR_MS)
    const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)
    return `${hours} h ${String(minutes).padStart(2, '0')}`
  }
  const days = Math.floor(remainingMs / DAY_MS)
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS)
  return `${days} j ${hours} h`
}

export const RESET_UNKNOWN = 'reset inconnu'
export const RESET_PASSED = 'fenêtre réinitialisée'

/** The reset label at `nowMs`; a string, so a 1 Hz ticker only re-renders when it changes. */
export function resetLabel(resetsAtMs: number | null, nowMs: number): string {
  if (resetsAtMs === null) return RESET_UNKNOWN
  if (isExpired(resetsAtMs, nowMs)) return RESET_PASSED
  return `reset ${formatCountdown(resetsAtMs - nowMs)}`
}

export type GaugeSource = 'live' | 'history' | 'none'

export interface GaugeInputs {
  source: GaugeSource
  fiveHour: GaugeInput
  sevenDay: GaugeInput
}

function fromWindow(window: LiveWindow | RateLimitWindow | null | undefined, limit: number): GaugeInput {
  return {
    utilization: window ? window.utilization : null,
    resetsAtMs: window ? toResetMs(window.resetsAt) : null,
    limit,
  }
}

/** The two windows: the daemon's live snapshot first, else its last persisted one. */
export function gaugeInputs(budget: DispatcherBudget | undefined, history: RateLimitSnapshot | null | undefined): GaugeInputs {
  const limits = {
    fiveHour: budget && budget.verdict.limit5h > 0 ? budget.verdict.limit5h : DEFAULT_LIMITS.fiveHour,
    sevenDay: budget && budget.verdict.limit7d > 0 ? budget.verdict.limit7d : DEFAULT_LIMITS.sevenDay,
  }
  if (budget?.live) {
    return {
      source: 'live',
      fiveHour: fromWindow(budget.live.fiveHour, limits.fiveHour),
      sevenDay: fromWindow(budget.live.sevenDay, limits.sevenDay),
    }
  }
  if (history) {
    return {
      source: 'history',
      fiveHour: fromWindow(history.fiveHour, limits.fiveHour),
      sevenDay: fromWindow(history.sevenDay, limits.sevenDay),
    }
  }
  return {
    source: 'none',
    fiveHour: fromWindow(null, limits.fiveHour),
    sevenDay: fromWindow(null, limits.sevenDay),
  }
}
