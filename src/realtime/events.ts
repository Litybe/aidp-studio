import type { BusEvent } from '../api/types'
import { Ring } from '../lib/ring'
import { Store } from '../lib/store'
import type { VisibilitySource } from '../lib/visibility'

/** What `EventSource` offers that the stream uses; tests pass a fake. */
export interface EventSourceLike {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  onerror: ((event: Event) => void) | null
  close(): void
}

/**
 * `connecting`: first attempt. `open`: events flow. `reconnecting`: the stream dropped, the daemon
 * answered its last probe. `unreachable`: the daemon did not answer the last probe.
 */
export type ConnectionPhase = 'connecting' | 'open' | 'reconnecting' | 'unreachable'

export interface ConnectionState {
  phase: ConnectionPhase
  /** Failed attempts since the last open stream. */
  attempts: number
  /** When the next attempt starts (ms since epoch); null while connected or waiting for the tab. */
  nextRetryAt: number | null
}

/** Why the whole cache must be refetched: the replay cannot cover what was missed. */
export type ResyncReason = 'restart' | 'gap'

export interface Backoff {
  initialMs: number
  maxMs: number
  factor: number
}

export const DEFAULT_BACKOFF: Backoff = { initialMs: 1000, maxMs: 30_000, factor: 2 }
export const EVENTS_URL = '/api/events'
/** Recent events kept for diagnostics; never more. */
export const RECENT_CAPACITY = 50

export interface EventStreamOptions {
  /** `GET /api/gateway/status`: proves the daemon answers, and its `startedAt` reveals a restart. */
  probe: () => Promise<{ startedAt: string }>
  onEvent: (event: BusEvent) => void
  /** The replay of `?since=` cannot cover the gap: refetch everything. */
  onResync: (reason: ResyncReason) => void
  /** The stream is open (first time or again). */
  onOpen?: () => void
  visibility: VisibilitySource
  createSource?: (url: string) => EventSourceLike
  backoff?: Backoff
  url?: string
  /** Single-use `?es=` token asked before each (re)connection; null or absent: no parameter. */
  getStreamToken?: () => Promise<string | null>
  clock?: () => number
}

/** Delay before attempt `attempts + 1`, exponential and capped. */
export function backoffDelay(attempts: number, backoff: Backoff = DEFAULT_BACKOFF): number {
  const exponent = Math.max(0, attempts - 1)
  return Math.min(backoff.maxMs, backoff.initialMs * backoff.factor ** exponent)
}

function parseEvent(raw: string): BusEvent | null {
  try {
    const value = JSON.parse(raw) as Partial<BusEvent>
    if (typeof value.id !== 'number' || typeof value.type !== 'string') return null
    return { id: value.id, type: value.type, ts: typeof value.ts === 'number' ? value.ts : 0, data: value.data }
  } catch {
    return null
  }
}

/**
 * The single `EventSource` of the app on `GET /api/events`. The daemon replays its ring
 * (`Bus::recent`) after `?since=<last id>`; it sends no `id:` field, so `Last-Event-ID` is not
 * used and the browser's own retry is disabled: this class reconnects with a capped backoff,
 * probes the daemon first, and waits while the tab is hidden.
 */
export class EventStream {
  readonly state: Store<ConnectionState>
  readonly recent = new Ring<BusEvent>(RECENT_CAPACITY)
  private source: EventSourceLike | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private lastId = 0
  private startedAt: string | null = null
  private everOpened = false
  private awaitingFirstEvent = false
  private stopped = true
  private waitingForVisible = false
  private connecting = false
  private readonly bootedAt: number
  private readonly unsubscribeVisibility: () => void
  private readonly createSource: (url: string) => EventSourceLike
  private readonly backoff: Backoff
  private readonly url: string
  private readonly clock: () => number

  constructor(private readonly options: EventStreamOptions) {
    this.createSource = options.createSource ?? ((url) => new EventSource(url) as unknown as EventSourceLike)
    this.backoff = options.backoff ?? DEFAULT_BACKOFF
    this.url = options.url ?? EVENTS_URL
    this.clock = options.clock ?? Date.now
    this.bootedAt = this.clock()
    this.state = new Store<ConnectionState>({ phase: 'connecting', attempts: 0, nextRetryAt: null }, options.visibility)
    this.unsubscribeVisibility = options.visibility.subscribe((hidden) => {
      if (!hidden && this.waitingForVisible) void this.connect()
    })
  }

  get lastEventId(): number {
    return this.lastId
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    this.clearRetry()
    this.closeSource()
    this.unsubscribeVisibility()
  }

  /** Skips the remaining backoff (the "Réessayer" button). */
  retryNow(): void {
    if (this.stopped || this.source) return
    this.clearRetry()
    void this.connect()
  }

  private async connect(): Promise<void> {
    this.waitingForVisible = false
    if (this.stopped || this.connecting || this.source) return
    this.connecting = true
    let startedAt: string
    try {
      startedAt = (await this.options.probe()).startedAt
    } catch {
      this.connecting = false
      this.fail('unreachable')
      return
    }
    this.connecting = false
    if (this.stopped) return
    const restarted = this.startedAt !== null && this.startedAt !== startedAt
    this.startedAt = startedAt
    if (restarted) {
      this.lastId = 0
      this.options.onResync('restart')
    }
    let streamToken: string | null = null
    if (this.options.getStreamToken) {
      this.connecting = true
      try {
        streamToken = await this.options.getStreamToken()
      } catch {
        this.connecting = false
        this.fail('reconnecting')
        return
      }
      this.connecting = false
      if (this.stopped) return
    }
    const query = `since=${this.lastId}${streamToken ? `&es=${encodeURIComponent(streamToken)}` : ''}`
    const source = this.createSource(`${this.url}?${query}`)
    this.source = source
    this.awaitingFirstEvent = this.everOpened && !restarted
    source.onopen = () => {
      const current = this.state.getSnapshot()
      this.everOpened = true
      this.state.set({ phase: 'open', attempts: 0, nextRetryAt: null })
      if (current.phase !== 'open') this.options.onOpen?.()
    }
    source.onmessage = (message) => this.receive(message.data)
    source.onerror = () => {
      if (this.source !== source) return
      this.closeSource()
      this.fail('reconnecting')
    }
  }

  private receive(raw: string): void {
    const event = parseEvent(raw)
    if (!event || event.id <= this.lastId) return
    if (this.awaitingFirstEvent) {
      this.awaitingFirstEvent = false
      if (event.id > this.lastId + 1) this.options.onResync('gap')
    }
    this.lastId = event.id
    this.recent.push(event)
    if (this.isAfterBoot(event)) this.options.onEvent(event)
  }

  /** Replayed events older than the app predate its first fetches: they change nothing. */
  private isAfterBoot(event: BusEvent): boolean {
    return event.ts === 0 || event.ts >= this.bootedAt
  }

  private fail(phase: 'reconnecting' | 'unreachable'): void {
    if (this.stopped) return
    const attempts = this.state.getSnapshot().attempts + 1
    if (this.options.visibility.isHidden()) {
      this.waitingForVisible = true
      this.state.set({ phase, attempts, nextRetryAt: null })
      return
    }
    const delay = backoffDelay(attempts, this.backoff)
    this.state.set({ phase, attempts, nextRetryAt: this.clock() + delay })
    this.clearRetry()
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.connect()
    }, delay)
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private closeSource(): void {
    if (!this.source) return
    this.source.onopen = null
    this.source.onmessage = null
    this.source.onerror = null
    this.source.close()
    this.source = null
  }
}
