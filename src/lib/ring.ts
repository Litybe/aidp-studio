/** Fixed-capacity ring: the oldest item is dropped once full. Every stream buffer uses one. */
export class Ring<T> {
  private readonly items: (T | undefined)[]
  private start = 0
  private count = 0

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('capacity must be a positive integer')
    this.items = new Array<T | undefined>(capacity)
  }

  get size(): number {
    return this.count
  }

  push(item: T): void {
    const end = (this.start + this.count) % this.capacity
    this.items[end] = item
    if (this.count < this.capacity) this.count += 1
    else this.start = (this.start + 1) % this.capacity
  }

  /** Oldest first. */
  toArray(): T[] {
    const out: T[] = []
    for (let index = 0; index < this.count; index += 1) {
      out.push(this.items[(this.start + index) % this.capacity] as T)
    }
    return out
  }

  clear(): void {
    this.items.fill(undefined)
    this.start = 0
    this.count = 0
  }
}
