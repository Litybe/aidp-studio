import type { EventSourceLike } from '../realtime/events'
import type { VisibilitySource } from '../lib/visibility'

/** A tab whose visibility the test flips by hand. */
export class FakeVisibility implements VisibilitySource {
  private hidden = false
  private readonly listeners = new Set<(hidden: boolean) => void>()

  isHidden(): boolean {
    return this.hidden
  }

  subscribe(listener: (hidden: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  set(hidden: boolean): void {
    this.hidden = hidden
    for (const listener of this.listeners) listener(hidden)
  }
}

/** An `EventSource` the test opens, feeds and breaks. */
export class FakeSource implements EventSourceLike {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(readonly url: string) {}

  open(): void {
    this.onopen?.(new Event('open'))
  }

  emit(event: { id: number; type: string; ts?: number; data?: unknown }): void {
    const frame = { ts: 0, data: {}, ...event }
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(frame) }))
  }

  fail(): void {
    this.onerror?.(new Event('error'))
  }

  close(): void {
    this.closed = true
  }
}
