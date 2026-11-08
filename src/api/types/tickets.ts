// Tickets as `GET /api/tickets` serves them (frontmatter of the ticket note, snake_case where the
// Rust struct has no rename) plus the C11 fields (camelCase) added by P2 / F1-daemon / P5.

export type TicketRoute = 'code' | 'art' | 'map' | 'doc'

/** C11: `flowSummary`, null without an active flow. */
export interface FlowSummary {
  flowKey: string
  status: string
  phase: string | null
  stepId: string | null
  iteration: number
  startedAt: string | null
}

export interface Milestone {
  title: string
  dueOn: string | null
}

/** Lane of the ticket (C13): dev worktree, waiting for the Unity test, or under test. */
export type TicketPhase = 'dev' | 'to-test' | 'testing'

export interface Ticket {
  key: string
  summary: string
  /** `todo`, `queued`, `in-progress`, `in-review`, `done`, `blocked`, `cancelled`, or `blocked: <reason>`. */
  status: string
  priority?: string
  service?: string
  labels?: string[]
  route?: TicketRoute | null
  milestone?: Milestone | null
  githubNumber?: number | null
  url?: string | null
  flowSummary?: FlowSummary | null
  /** C13; absent on a daemon that predates the two lanes. */
  phase?: TicketPhase | null
  branch?: string | null
  blocked_reason?: string | null
  blockedReason?: string | null
  updated?: string
}

/** `GET /api/tickets/:key`. */
export interface TicketDetail {
  ticket: Ticket
  body: string
}

/** `GET /api/tickets/:key/cost` (T1); every field is optional until the route is final. */
export interface TicketCost {
  costUsd?: number | null
  tokens?: number | null
  totalTokens?: number | null
  turns?: number | null
  reviewTurns?: number | null
  testTurns?: number | null
}

/** The ten columns of the board (PLAN-GAMEDEV §3.1). */
export type ColumnId =
  | 'triage'
  | 'ready'
  | 'queued'
  | 'realisation'
  | 'review'
  | 'to-test'
  | 'test'
  | 'merge'
  | 'blocked'
  | 'done'

/** `GET /api/queue` entry. */
export interface QueueEntry {
  id: string
  projectId: string
  target?: string
  priority: number
  status: string
}

/** `GET /api/tickets/:key/pr`, whatever the daemon knows; every field is optional. */
export interface TicketPr {
  number?: number
  url?: string
  state?: string
  additions?: number
  deletions?: number
  changedFiles?: number
  /** `owner/name` of the repository and the tip of the PR branch (what the merge decision looks at). */
  repo?: string
  head?: { ref?: string; sha?: string }
}
