// What the Inbox page derives from `GET /api/inbox` and `GET /api/tickets`.
import type { InboxEntry } from '../types'
import type { Ticket } from './tickets'

/** A `flow.human` entry, parsed: `detail` reads `<ticket key> / <step id>`. */
export interface FlowDecision {
  entry: InboxEntry
  key: string
  stepId: string
  /** The inbox item id (`fingerprint`). */
  itemId: string | null
}

export interface InboxGroups {
  merges: FlowDecision[]
  budget: FlowDecision[]
  decisions: FlowDecision[]
  questions: InboxEntry[]
  others: InboxEntry[]
  blocked: Ticket[]
}
