import type { Ticket } from '../../api/types'
import { columnOf } from '../board/columns'

export interface TestQueue {
  /** The issue under test in the main checkout (one at a time), if any. */
  current: Ticket | null
  /** The `to-test` issues in the daemon's order (oldest first, manual promotion in front). */
  waiting: Ticket[]
}

/** The test lane of C13 out of the ticket list; the daemon's order is kept. */
export function testQueue(tickets: readonly Ticket[]): TestQueue {
  let current: Ticket | null = null
  const waiting: Ticket[] = []
  for (const ticket of tickets) {
    const column = columnOf(ticket)
    if (column === 'test') current ??= ticket
    else if (column === 'to-test') waiting.push(ticket)
  }
  return { current, waiting }
}
