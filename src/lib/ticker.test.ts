import { FakeVisibility } from '../test/fakes'
import { Ticker } from './ticker'

describe('Ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-11-06T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs no timer without a listener', () => {
    const ticker = new Ticker(new FakeVisibility())
    expect(ticker.running).toBe(false)
    const unsubscribe = ticker.subscribe(() => {})
    expect(ticker.running).toBe(true)
    unsubscribe()
    expect(ticker.running).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ticks at 1 Hz at most, one timer for every listener', () => {
    const ticker = new Ticker(new FakeVisibility())
    const first = vi.fn()
    const second = vi.fn()
    ticker.subscribe(first)
    ticker.subscribe(second)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(5_000)
    expect(first).toHaveBeenCalledTimes(5)
    expect(second).toHaveBeenCalledTimes(5)
    expect(() => new Ticker(new FakeVisibility(), 250)).toThrow(RangeError)
  })

  it('stops while the tab is hidden and catches up once on return', () => {
    const visibility = new FakeVisibility()
    const ticker = new Ticker(visibility)
    const listener = vi.fn()
    ticker.subscribe(listener)
    vi.advanceTimersByTime(2_000)
    expect(listener).toHaveBeenCalledTimes(2)

    visibility.set(true)
    expect(ticker.running).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(listener).toHaveBeenCalledTimes(2)

    visibility.set(false)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(ticker.getSnapshot()).toBe(Date.now())
    expect(ticker.running).toBe(true)
    vi.advanceTimersByTime(1_000)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('does not start when subscribed from a hidden tab', () => {
    const visibility = new FakeVisibility()
    visibility.set(true)
    const ticker = new Ticker(visibility)
    ticker.subscribe(() => {})
    expect(ticker.running).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
