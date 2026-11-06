import { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { InvalidationBatcher } from '../realtime/invalidation'
import { RealtimeContext } from '../realtime/context'
import { EventStream } from '../realtime/events'
import type { Realtime } from '../realtime/runtime'
import { Ticker } from '../lib/ticker'
import { FakeVisibility } from '../test/fakes'
import { Gauge } from './Gauge'

const NOW = Date.parse('2026-11-06T12:00:00.000Z')
const MINUTE = 60_000

function realtime(visibility: FakeVisibility): Realtime {
  const queryClient = new QueryClient()
  return {
    ticker: new Ticker(visibility),
    batcher: new InvalidationBatcher((keys) => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey })), visibility),
    stream: new EventStream({ probe: async () => ({ startedAt: '' }), onEvent: () => {}, onResync: () => {}, visibility }),
  }
}

describe('Gauge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the percent, the threshold colour and a live reset countdown', () => {
    const visibility = new FakeVisibility()
    render(
      <RealtimeContext.Provider value={realtime(visibility)}>
        <Gauge label="5h" utilization={0.62} resetsAtMs={NOW + 2 * MINUTE + 30_000} limit={0.8} source="live" />
      </RealtimeContext.Provider>,
    )
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(screen.getByText('reset 2 min')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-5h')).toHaveAttribute('data-level', 'ok')
    expect(screen.getByRole('meter', { name: 'Fenêtre 5h' })).toHaveAttribute('aria-valuenow', '62')

    act(() => {
      vi.advanceTimersByTime(MINUTE)
    })
    expect(screen.getByText('reset 1 min')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2 * MINUTE)
    })
    expect(screen.getByText('fenêtre réinitialisée')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-5h')).toHaveAttribute('data-level', 'unknown')
  })

  it('warns near the threshold and shows an unknown window plainly', () => {
    const visibility = new FakeVisibility()
    render(
      <RealtimeContext.Provider value={realtime(visibility)}>
        <Gauge label="5h" utilization={0.7} resetsAtMs={null} limit={0.8} source="history" />
        <Gauge label="7j" utilization={null} resetsAtMs={null} limit={0.9} source="none" />
      </RealtimeContext.Provider>,
    )
    expect(screen.getByTestId('gauge-5h')).toHaveAttribute('data-level', 'warn')
    expect(screen.getByTestId('gauge-7j')).toHaveAttribute('data-level', 'unknown')
    expect(screen.getAllByText('reset inconnu')).toHaveLength(2)
  })
})
