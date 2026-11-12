import type { DispatcherState } from '../api/queries'
import { bugLaneLabel, dispatcherSummary } from './DispatcherIndicator'

const state: DispatcherState = {
  mode: 'normal',
  paused: false,
  waitUntil: null,
  lastTickAt: '',
  lastReason: '',
  slots: { used: 0, max: 3, testUsed: 0, testMax: 1 },
  running: [],
}

describe('dispatcherSummary', () => {
  it('reads active, manual pause, budget pause and waiting', () => {
    expect(dispatcherSummary(state, false)).toEqual({ label: 'actif', tone: 'ok' })
    expect(dispatcherSummary({ ...state, paused: true }, false).label).toBe('en pause (manuel)')
    expect(dispatcherSummary(state, true).label).toBe('en pause (budget)')
    expect(dispatcherSummary({ ...state, mode: 'waiting', waitUntil: '2026-11-11T10:30:00Z' }, false).label).toMatch(/^en attente jusqu'à \d\d:\d\d$/)
  })
})

describe('bugLaneLabel', () => {
  it('shows the bug lane only when the daemon reports it', () => {
    expect(bugLaneLabel(state.slots)).toBe('')
    expect(bugLaneLabel({ ...state.slots, bugUsed: 1, bugMax: 2 })).toBe(' · bugs 1/2')
    expect(bugLaneLabel({ ...state.slots, bugMax: 1 })).toBe(' · bugs 0/1')
  })
})
