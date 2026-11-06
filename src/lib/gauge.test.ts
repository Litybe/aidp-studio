import type { DispatcherBudget, RateLimitSnapshot } from '../api/types'
import {
  computeGauge,
  DEFAULT_LIMITS,
  formatCountdown,
  gaugeInputs,
  isExpired,
  resetLabel,
  RESET_PASSED,
  RESET_UNKNOWN,
  toResetMs,
} from './gauge'

const NOW = Date.parse('2026-11-06T12:00:00.000Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE

const verdict: DispatcherBudget['verdict'] = {
  verdict: 'allow',
  maxLaunches: 3,
  why: '',
  utilization5h: 0.62,
  utilization7d: 0.21,
  limit5h: 0.8,
  limit7d: 0.9,
  reserve5h: 0.1,
  reserve7d: 0.02,
  unreflected: 0,
  resetsAt5h: '2026-11-06T14:14:00.000Z',
  waitWindow: null,
  observedAt: '2026-11-06T11:59:00.000Z',
}

describe('toResetMs', () => {
  it('reads UNIX seconds, UNIX milliseconds and RFC 3339', () => {
    expect(toResetMs(1_757_500_000)).toBe(1_757_500_000_000)
    expect(toResetMs(1_757_500_000_000)).toBe(1_757_500_000_000)
    expect(toResetMs('2026-11-06T14:14:00.000Z')).toBe(Date.parse('2026-11-06T14:14:00.000Z'))
  })

  it('gives null for absent or unreadable values', () => {
    expect(toResetMs(null)).toBeNull()
    expect(toResetMs(undefined)).toBeNull()
    expect(toResetMs(0)).toBeNull()
    expect(toResetMs('not a date')).toBeNull()
  })
})

describe('computeGauge', () => {
  it('rounds the percent and colours by threshold', () => {
    expect(computeGauge({ utilization: 0.624, resetsAtMs: NOW + HOUR, limit: 0.8 }, false)).toEqual({
      percent: 62,
      level: 'ok',
      resetsAtMs: NOW + HOUR,
      expired: false,
    })
    expect(computeGauge({ utilization: 0.7, resetsAtMs: null, limit: 0.8 }, false).level).toBe('warn')
    expect(computeGauge({ utilization: 0.8, resetsAtMs: null, limit: 0.8 }, false).level).toBe('danger')
  })

  it('clamps an overage to 100 and stays danger', () => {
    const model = computeGauge({ utilization: 1.3, resetsAtMs: null, limit: 0.8 }, false)
    expect(model.percent).toBe(100)
    expect(model.level).toBe('danger')
  })

  it('is unknown without a measure or once the window has reset', () => {
    expect(computeGauge({ utilization: null, resetsAtMs: null, limit: 0.8 }, false)).toMatchObject({
      percent: null,
      level: 'unknown',
    })
    expect(computeGauge({ utilization: 0.95, resetsAtMs: NOW - MINUTE, limit: 0.8 }, true)).toMatchObject({
      percent: null,
      level: 'unknown',
      expired: true,
    })
  })
})

describe('reset countdown', () => {
  it('formats with minute granularity', () => {
    expect(formatCountdown(30_000)).toBe('< 1 min')
    expect(formatCountdown(14 * MINUTE + 59_000)).toBe('14 min')
    expect(formatCountdown(2 * HOUR + 5 * MINUTE)).toBe('2 h 05')
    expect(formatCountdown(3 * 24 * HOUR + 4 * HOUR + 10 * MINUTE)).toBe('3 j 4 h')
  })

  it('labels the reset from the clock', () => {
    expect(resetLabel(NOW + 2 * HOUR + 14 * MINUTE, NOW)).toBe('reset 2 h 14')
    expect(resetLabel(NOW, NOW)).toBe(RESET_PASSED)
    expect(resetLabel(null, NOW)).toBe(RESET_UNKNOWN)
    expect(isExpired(NOW - 1, NOW)).toBe(true)
    expect(isExpired(null, NOW)).toBe(false)
  })

  it('keeps the same label within a minute, so the ticker does not re-render', () => {
    const reset = NOW + 2 * HOUR + 14 * MINUTE + 30_000
    expect(resetLabel(reset, NOW)).toBe(resetLabel(reset, NOW + 20_000))
  })
})

describe('gaugeInputs', () => {
  it('prefers the live snapshot of the dispatcher budget', () => {
    const budget: DispatcherBudget = {
      verdict,
      live: {
        status: 'ok',
        isUsingOverage: false,
        fiveHour: { utilization: 0.62, resetsAt: '2026-11-06T14:14:00.000Z' },
        sevenDay: { utilization: 0.21, resetsAt: '2026-11-10T09:00:00.000Z' },
        observedAt: '2026-11-06T11:59:00.000Z',
      },
      reserves: { fiveHour: 0.1, sevenDay: 0.02, learned: true },
      unreflected: 0,
      stats: {},
    }
    const inputs = gaugeInputs(budget, null)
    expect(inputs.source).toBe('live')
    expect(inputs.fiveHour).toEqual({ utilization: 0.62, resetsAtMs: Date.parse('2026-11-06T14:14:00.000Z'), limit: 0.8 })
    expect(inputs.sevenDay.limit).toBe(0.9)
  })

  it('falls back to the last persisted snapshot, in UNIX seconds', () => {
    const budget: DispatcherBudget = {
      verdict: { ...verdict, limit5h: 0, limit7d: 0 },
      live: null,
      reserves: { fiveHour: 0, sevenDay: 0, learned: false },
      unreflected: 0,
      stats: {},
    }
    const history: RateLimitSnapshot = {
      status: 'ok',
      isUsingOverage: false,
      fiveHour: { utilization: 0.42, resetsAt: 1_762_430_000 },
      sevenDay: null,
      observedAt: 1_762_420_000_000,
    }
    const inputs = gaugeInputs(budget, history)
    expect(inputs.source).toBe('history')
    expect(inputs.fiveHour).toEqual({ utilization: 0.42, resetsAtMs: 1_762_430_000_000, limit: DEFAULT_LIMITS.fiveHour })
    expect(inputs.sevenDay.utilization).toBeNull()
  })

  it('reports no measure at all', () => {
    expect(gaugeInputs(undefined, null).source).toBe('none')
  })
})
