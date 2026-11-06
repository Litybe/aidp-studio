import type { QueryKey } from '@tanstack/react-query'
import { queryKeys } from '../api/queries'
import type { BusEvent } from '../api/types'
import { FakeVisibility } from '../test/fakes'
import { INVALIDATION_WINDOW_MS, InvalidationBatcher, keyId, keysForEvent } from './invalidation'

const event = (type: string, data: unknown = {}): BusEvent => ({ id: 1, type, ts: 0, data })
const ids = (keys: QueryKey[]) => keys.map(keyId).sort()

describe('keysForEvent', () => {
  it('maps a flow step to the flow list and that flow', () => {
    expect(ids(keysForEvent(event('flow.step_changed', { key: 'GH-12', stepId: 'review' })))).toEqual(
      ids([queryKeys.flows, queryKeys.flow('GH-12')]),
    )
  })

  it('maps a ticket transition to the tickets and the ticket flow', () => {
    expect(ids(keysForEvent(event('ticket.status', { key: 'GH-3', from: 'todo', to: 'queued' })))).toEqual(
      ids([queryKeys.tickets, queryKeys.flow('GH-3')]),
    )
  })

  it('maps a rate-limit change to the budget prefix and the status', () => {
    expect(ids(keysForEvent(event('gateway.rate_limit')))).toEqual(ids([queryKeys.budget, queryKeys.gatewayStatus]))
  })

  it('unions exact and prefix rules without duplicates', () => {
    const keys = keysForEvent(event('session.ended'))
    expect(ids(keys)).toEqual(
      ids([queryKeys.sessions, queryKeys.gatewayStatus, queryKeys.inbox, queryKeys.budget, queryKeys.usage]),
    )
    expect(new Set(ids(keys)).size).toBe(keys.length)
  })

  it('ignores an unknown type and a missing flow key', () => {
    expect(keysForEvent(event('overflow'))).toEqual([])
    expect(ids(keysForEvent(event('flow.started', {})))).toEqual(ids([queryKeys.flows]))
  })

  it('does not take a prefix for a longer word', () => {
    expect(keysForEvent(event('flowchart.saved'))).toEqual([])
  })
})

describe('InvalidationBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes a burst once per window, deduplicated by key', () => {
    const flush = vi.fn<(keys: QueryKey[]) => void>()
    const batcher = new InvalidationBatcher(flush, new FakeVisibility())
    for (let index = 0; index < 50; index += 1) {
      batcher.add(keysForEvent(event('flow.step_changed', { key: 'GH-12' })))
      batcher.add(keysForEvent(event('gateway.rate_limit')))
    }
    vi.advanceTimersByTime(INVALIDATION_WINDOW_MS - 1)
    expect(flush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(ids(flush.mock.calls[0]?.[0] ?? [])).toEqual(
      ids([queryKeys.flows, queryKeys.flow('GH-12'), queryKeys.budget, queryKeys.gatewayStatus]),
    )
    vi.advanceTimersByTime(10 * INVALIDATION_WINDOW_MS)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('starts a new window after a flush', () => {
    const flush = vi.fn<(keys: QueryKey[]) => void>()
    const batcher = new InvalidationBatcher(flush, new FakeVisibility())
    batcher.add([queryKeys.inbox])
    vi.advanceTimersByTime(INVALIDATION_WINDOW_MS)
    batcher.add([queryKeys.inbox])
    vi.advanceTimersByTime(INVALIDATION_WINDOW_MS)
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('holds everything while the tab is hidden, then replays it once on return', () => {
    const visibility = new FakeVisibility()
    const flush = vi.fn<(keys: QueryKey[]) => void>()
    const batcher = new InvalidationBatcher(flush, visibility)
    batcher.add([queryKeys.inbox])
    visibility.set(true)
    batcher.add([queryKeys.tickets])
    batcher.add([queryKeys.inbox])
    vi.advanceTimersByTime(60_000)
    expect(flush).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(batcher.pendingCount).toBe(2)
    visibility.set(false)
    vi.advanceTimersByTime(INVALIDATION_WINDOW_MS)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(ids(flush.mock.calls[0]?.[0] ?? [])).toEqual(ids([queryKeys.inbox, queryKeys.tickets]))
  })
})
