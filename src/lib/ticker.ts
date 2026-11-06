import type { VisibilitySource } from './visibility'

/**
 * The only timer of the countdowns: 1 Hz at most, running only while someone listens and the tab
 * is visible. Back to visible, it catches up once, then ticks again.
 */
export class Ticker {
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private current: number
  private unsubscribeVisibility: (() => void) | null = null

  constructor(
    private readonly visibility: VisibilitySource,
    private readonly periodMs = 1000,
    private readonly clock: () => number = Date.now,
  ) {
    if (periodMs < 1000) throw new RangeError('the ticker runs at 1 Hz at most')
    this.current = clock()
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (!this.unsubscribeVisibility) {
      this.unsubscribeVisibility = this.visibility.subscribe((hidden) => {
        if (!hidden) this.tick()
        this.sync()
      })
    }
    this.sync()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0 && this.unsubscribeVisibility) {
        this.unsubscribeVisibility()
        this.unsubscribeVisibility = null
      }
      this.sync()
    }
  }

  readonly getSnapshot = (): number => this.current

  get running(): boolean {
    return this.timer !== null
  }

  private tick(): void {
    this.current = this.clock()
    for (const listener of this.listeners) listener()
  }

  private sync(): void {
    const shouldRun = this.listeners.size > 0 && !this.visibility.isHidden()
    if (shouldRun && this.timer === null) {
      this.current = this.clock()
      this.timer = setInterval(() => this.tick(), this.periodMs)
    } else if (!shouldRun && this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
