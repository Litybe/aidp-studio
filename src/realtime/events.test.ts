import type { BusEvent } from '../api/types'
import { FakeSource, FakeVisibility } from '../test/fakes'
import { backoffDelay, DEFAULT_BACKOFF, EventStream, type ResyncReason } from './events'

const BOOT = Date.parse('2026-11-06T12:00:00.000Z')
const STARTED_AT = '2026-11-06T08:00:00.000Z'

function setup(options: { visibility?: FakeVisibility } = {}) {
  const sources: FakeSource[] = []
  const events: BusEvent[] = []
  const resyncs: ResyncReason[] = []
  const opens: number[] = []
  const probe = vi.fn(async () => ({ startedAt: STARTED_AT }))
  const visibility = options.visibility ?? new FakeVisibility()
  const stream = new EventStream({
    probe,
    onEvent: (event) => events.push(event),
    onResync: (reason) => resyncs.push(reason),
    onOpen: () => opens.push(Date.now()),
    visibility,
    createSource: (url) => {
      const source = new FakeSource(url)
      sources.push(source)
      return source
    },
  })
  const last = () => {
    const source = sources.at(-1)
    if (!source) throw new Error('no source opened')
    return source
  }
  return { stream, sources, last, events, resyncs, opens, probe, visibility }
}

/** Lets the awaited probe settle. */
const settle = () => vi.advanceTimersByTimeAsync(0)

describe('backoffDelay', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((attempts) => backoffDelay(attempts))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ])
    expect(backoffDelay(0, DEFAULT_BACKOFF)).toBe(1000)
  })
})

describe('EventStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BOOT)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens one stream from id 0 and drops the replay older than the app', async () => {
    const { stream, sources, last, events, opens } = setup()
    stream.start()
    await settle()
    expect(sources).toHaveLength(1)
    expect(last().url).toBe('/api/events?since=0')
    last().open()
    expect(stream.state.getSnapshot().phase).toBe('open')
    expect(opens).toHaveLength(1)
    last().emit({ id: 7, type: 'ticket.status', ts: BOOT - 60_000 })
    last().emit({ id: 8, type: 'ticket.status', ts: BOOT + 10 })
    expect(events.map((event) => event.id)).toEqual([8])
    expect(stream.lastEventId).toBe(8)
    expect(stream.recent.toArray().map((event) => event.id)).toEqual([7, 8])
  })

  it('asks a fresh single-use token before every (re)connection', async () => {
    const sources: FakeSource[] = []
    const order: string[] = []
    let n = 0
    const stream = new EventStream({
      probe: async () => ({ startedAt: STARTED_AT }),
      onEvent: () => {},
      onResync: () => {},
      visibility: new FakeVisibility(),
      getStreamToken: async () => {
        order.push('token')
        return `t${++n}`
      },
      createSource: (url) => {
        order.push('source')
        const source = new FakeSource(url)
        sources.push(source)
        return source
      },
    })
    stream.start()
    await settle()
    expect(order).toEqual(['token', 'source'])
    expect(sources[0]?.url).toBe('/api/events?since=0&es=t1')
    sources[0]?.fail()
    await vi.advanceTimersByTimeAsync(1000)
    expect(sources[1]?.url).toBe('/api/events?since=0&es=t2')
    stream.stop()
  })

  it('reconnects with backoff and resumes after the last id', async () => {
    const { stream, sources, last, resyncs, probe } = setup()
    stream.start()
    await settle()
    last().open()
    last().emit({ id: 41, type: 'flow.step_changed', ts: BOOT + 1 })
    last().fail()
    expect(sources[0]?.closed).toBe(true)
    expect(stream.state.getSnapshot()).toMatchObject({ phase: 'reconnecting', attempts: 1 })
    await vi.advanceTimersByTimeAsync(999)
    expect(sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(probe).toHaveBeenCalledTimes(2)
    expect(last().url).toBe('/api/events?since=41')
    last().open()
    last().emit({ id: 42, type: 'flow.step_changed', ts: BOOT + 2 })
    expect(resyncs).toEqual([])
    expect(stream.state.getSnapshot()).toMatchObject({ phase: 'open', attempts: 0 })
  })

  it('asks for a resync when the replay starts after a gap', async () => {
    const { stream, last, resyncs, events } = setup()
    stream.start()
    await settle()
    last().open()
    last().emit({ id: 5, type: 'ticket.status', ts: BOOT + 1 })
    last().fail()
    await vi.advanceTimersByTimeAsync(1000)
    last().open()
    last().emit({ id: 300, type: 'ticket.status', ts: BOOT + 2 })
    expect(resyncs).toEqual(['gap'])
    expect(events.map((event) => event.id)).toEqual([5, 300])
  })

  it('starts again from id 0 after a daemon restart', async () => {
    const { stream, last, resyncs, probe } = setup()
    stream.start()
    await settle()
    last().open()
    last().emit({ id: 90, type: 'ticket.status', ts: BOOT + 1 })
    last().fail()
    probe.mockResolvedValueOnce({ startedAt: '2026-11-06T12:05:00.000Z' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(resyncs).toEqual(['restart'])
    expect(last().url).toBe('/api/events?since=0')
  })

  it('ignores duplicates and malformed frames', async () => {
    const { stream, last, events } = setup()
    stream.start()
    await settle()
    last().open()
    last().emit({ id: 3, type: 'pr.status', ts: BOOT + 1 })
    last().emit({ id: 3, type: 'pr.status', ts: BOOT + 1 })
    last().onmessage?.(new MessageEvent('message', { data: 'not json' }))
    expect(events).toHaveLength(1)
  })

  it('is unreachable while the probe fails, then retries with a growing delay', async () => {
    const { stream, sources, probe, last } = setup()
    probe.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'))
    stream.start()
    await settle()
    expect(stream.state.getSnapshot()).toMatchObject({ phase: 'unreachable', attempts: 1, nextRetryAt: BOOT + 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(stream.state.getSnapshot()).toMatchObject({ phase: 'unreachable', attempts: 2 })
    await vi.advanceTimersByTimeAsync(1999)
    expect(sources).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(sources).toHaveLength(1)
    last().open()
    expect(stream.state.getSnapshot().phase).toBe('open')
  })

  it('waits for the tab instead of retrying while it is hidden', async () => {
    const visibility = new FakeVisibility()
    const { stream, sources, probe } = setup({ visibility })
    probe.mockRejectedValueOnce(new Error('down'))
    visibility.set(true)
    stream.start()
    await settle()
    expect(stream.state.getSnapshot()).toMatchObject({ phase: 'unreachable', nextRetryAt: null })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sources).toHaveLength(0)
    visibility.set(false)
    await settle()
    expect(sources).toHaveLength(1)
  })

  it('retries at once on demand and stops cleanly', async () => {
    const { stream, sources, probe, last } = setup()
    probe.mockRejectedValueOnce(new Error('down'))
    stream.start()
    await settle()
    stream.retryNow()
    await settle()
    expect(sources).toHaveLength(1)
    stream.stop()
    expect(last().closed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
