import type { VisibilitySource } from './visibility'

/** A tiny external store for `useSyncExternalStore`; listeners are not called while the tab is hidden. */
export class Store<T> {
  private readonly listeners = new Set<() => void>()
  private pending = false
  private readonly unsubscribeVisibility: () => void

  constructor(
    private value: T,
    private readonly visibility: VisibilitySource,
  ) {
    this.unsubscribeVisibility = visibility.subscribe((hidden) => {
      if (!hidden && this.pending) this.notify()
    })
  }

  readonly getSnapshot = (): T => this.value

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return
    this.value = next
    if (this.visibility.isHidden()) this.pending = true
    else this.notify()
  }

  dispose(): void {
    this.unsubscribeVisibility()
    this.listeners.clear()
  }

  private notify(): void {
    this.pending = false
    for (const listener of this.listeners) listener()
  }
}
