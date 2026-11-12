import type { ColumnId, Ticket, TicketRoute } from '../../api/types'
import type { Tone } from '../../components/ui/classes'

export interface ColumnDef {
  id: ColumnId
  label: string
}

/** The ten states of PLAN-GAMEDEV §3.1 and C13, left to right. */
export const COLUMNS: readonly ColumnDef[] = [
  { id: 'triage', label: 'Triage' },
  { id: 'ready', label: 'Prêtes' },
  { id: 'queued', label: 'En file' },
  { id: 'realisation', label: 'Réalisation' },
  { id: 'review', label: 'Revue' },
  { id: 'to-test', label: 'À tester' },
  { id: 'test', label: 'Test Unity' },
  { id: 'merge', label: 'À merger' },
  { id: 'blocked', label: 'Bloquées' },
  { id: 'done', label: 'Faites' },
]

const FAILED_FLOW = new Set(['failed', 'escalated', 'aborted'])

export function blockedReason(ticket: Ticket): string | null {
  const explicit = ticket.blocked_reason ?? ticket.blockedReason
  if (explicit) return explicit
  const [, reason] = ticket.status.split(/:\s*/, 2)
  return reason ? reason : null
}

/**
 * The column of a ticket, or null for a ticket the board hides (`cancelled`, `aidp:skip`).
 * Order matters: end states first, then waiting-for-human states, then the live phase of the flow,
 * then the labels, then the bare status.
 */
export function columnOf(ticket: Ticket): ColumnId | null {
  const labels = new Set(ticket.labels ?? [])
  const status = ticket.status
  const flow = ticket.flowSummary ?? null
  if (status === 'cancelled' || labels.has('aidp:skip')) return null
  if (status === 'done' || labels.has('aidp:done')) return 'done'
  const blocked = status === 'blocked' || status.startsWith('blocked:') || labels.has('aidp:blocked')
  if (blocked) {
    return labels.has('aidp:triage') || blockedReason(ticket) === 'needs-refine' ? 'triage' : 'blocked'
  }
  if (labels.has('aidp:triage')) return 'triage'
  if (flow && FAILED_FLOW.has(flow.status)) return 'blocked'
  const step = flow?.stepId ?? ''
  const phase = flow?.phase ?? ''
  if (labels.has('aidp:awaiting-merge') || status === 'in-review' || (flow?.status === 'waiting_human' && /merge/i.test(step))) {
    return 'merge'
  }
  if (labels.has('aidp:testing') || ticket.phase === 'testing') return 'test'
  if (labels.has('aidp:to-test') || ticket.phase === 'to-test') return 'to-test'
  if (/test|unity|playtest/i.test(phase)) return 'test'
  if (labels.has('aidp:review') || labels.has('aidp:fixing') || /review|revue|fix/i.test(phase)) return 'review'
  if (labels.has('aidp:in-progress') || status === 'in-progress') return 'realisation'
  if (labels.has('aidp:queued') || status === 'queued') return 'queued'
  return 'ready'
}

export const BUG_TAG = 'aidp/bug'
const BUG_LABEL = 'bug'

/** A bug: the daemon's `aidp/bug` tag, else its `Bug` type, else the GitHub `bug` label. */
export function isBug(ticket: Ticket): boolean {
  if (ticket.tags?.includes(BUG_TAG)) return true
  if (ticket.type?.toLowerCase() === BUG_LABEL) return true
  return (ticket.labels ?? []).some((label) => label.toLowerCase() === BUG_LABEL)
}

const ART = new Set(['pixelart', 'art', 'sprite'])
const MAP = new Set(['map', 'ldtk', 'level', 'salle'])
const DOC = new Set(['doc', 'bible', 'documentation'])

/** The route of a ticket: the daemon's `route`, else the first matching label (§3.1), else code. */
export function routeOf(ticket: Ticket): TicketRoute {
  if (ticket.route) return ticket.route
  for (const label of ticket.labels ?? []) {
    if (ART.has(label) || label.startsWith('pixel:') || label.startsWith('asset:')) return 'art'
    if (MAP.has(label)) return 'map'
    if (DOC.has(label)) return 'doc'
  }
  return 'code'
}

export const ROUTE_ICON: Record<TicketRoute, { icon: string; label: string }> = {
  code: { icon: '</>', label: 'Code' },
  art: { icon: '◐', label: 'Art' },
  map: { icon: '▦', label: 'Map' },
  doc: { icon: '≡', label: 'Doc' },
}

/** `#n` of the card: the GitHub number, else the digits of the key (`GH-214`). */
export function ticketNumber(ticket: Ticket): string {
  if (ticket.githubNumber) return `#${ticket.githubNumber}`
  const digits = /(\d+)$/.exec(ticket.key)
  return digits ? `#${digits[1]}` : ticket.key
}

const COMMIT_PREFIX = /^(feat|fix|chore|docs|refactor|test|style|perf|build)(\([^)]*\))?!?:\s*/i

/** Title of a card without its `feat(art): ` prefix: the card already shows the route, and the room is scarce. */
export function displayTitle(summary: string): string {
  return summary.replace(COMMIT_PREFIX, '') || summary
}

export interface Filters {
  route: TicketRoute | ''
  milestone: string
  label: string
  /** Free text matched against the title and the `#n` (phone filter sheet). */
  query: string
}

export const NO_FILTERS: Filters = { route: '', milestone: '', label: '', query: '' }

export function matchesFilters(ticket: Ticket, filters: Filters): boolean {
  if (filters.route && routeOf(ticket) !== filters.route) return false
  if (filters.milestone && (ticket.milestone?.title ?? '') !== filters.milestone) return false
  if (filters.label && !(ticket.labels ?? []).includes(filters.label)) return false
  const query = filters.query.trim().toLowerCase().replace(/^#/, '')
  if (query && !ticket.summary.toLowerCase().includes(query) && !ticketNumber(ticket).toLowerCase().includes(query)) {
    return false
  }
  return true
}

export type Board = Record<ColumnId, Ticket[]>

/** Tickets grouped by column, filtered; each column keeps the daemon's dequeue order. */
export function buildBoard(tickets: readonly Ticket[], filters: Filters = NO_FILTERS): Board {
  const board = Object.fromEntries(COLUMNS.map((column) => [column.id, [] as Ticket[]])) as Board
  for (const ticket of tickets) {
    const column = columnOf(ticket)
    if (column && matchesFilters(ticket, filters)) board[column].push(ticket)
  }
  return board
}

export function filterOptions(tickets: readonly Ticket[]): { milestones: string[]; labels: string[] } {
  const milestones = new Set<string>()
  const labels = new Set<string>()
  for (const ticket of tickets) {
    if (ticket.milestone?.title) milestones.add(ticket.milestone.title)
    for (const label of ticket.labels ?? []) labels.add(label)
  }
  return { milestones: [...milestones].sort(), labels: [...labels].sort() }
}

/** A review that is over: the dev flow has ended and the ticket is still in the review column. */
export function canSendToTest(ticket: Ticket): boolean {
  if (columnOf(ticket) !== 'review') return false
  const status = ticket.flowSummary?.status
  return status === 'done' || status === 'completed'
}

export type StateId = 'ready' | 'dev' | 'review' | 'to-test' | 'test' | 'merge' | 'blocked' | 'done'

export interface StateDef {
  id: StateId
  label: string
  columns: readonly ColumnId[]
}

/** The phone view shows one state at a time; the ten columns fold into eight states. */
export const STATES: readonly StateDef[] = [
  { id: 'ready', label: 'Prêtes', columns: ['ready', 'queued'] },
  { id: 'dev', label: 'Dev', columns: ['realisation'] },
  { id: 'review', label: 'Revue', columns: ['review'] },
  { id: 'to-test', label: 'À tester', columns: ['to-test'] },
  { id: 'test', label: 'Test', columns: ['test'] },
  { id: 'merge', label: 'À merger', columns: ['merge'] },
  { id: 'blocked', label: 'Bloquées', columns: ['blocked', 'triage'] },
  { id: 'done', label: 'Faites', columns: ['done'] },
]

export function isStateId(value: unknown): value is StateId {
  return STATES.some((state) => state.id === value)
}

export function groupByState(board: Board): Record<StateId, Ticket[]> {
  return Object.fromEntries(
    STATES.map((state) => [state.id, state.columns.flatMap((column) => board[column])]),
  ) as Record<StateId, Ticket[]>
}

const ACTION_FIRST: readonly StateId[] = ['merge', 'blocked', 'to-test', 'dev', 'ready']

/** State opened by default: the first one that asks for an action, else the first non-empty. */
export function defaultState(grouped: Record<StateId, readonly Ticket[]>): StateId {
  const found = ACTION_FIRST.find((id) => grouped[id].length > 0)
  return found ?? STATES.find((state) => grouped[state.id].length > 0)?.id ?? 'ready'
}

export function activeFilterCount(filters: Filters): number {
  return [filters.milestone, filters.label, filters.query.trim()].filter(Boolean).length
}

/** Colour family of each column: waiting (accent), working (violet), testing (warn), merge (ok), stuck (danger). */
export const COLUMN_TONE: Record<ColumnId, Tone> = {
  triage: 'muted',
  ready: 'accent',
  queued: 'accent',
  realisation: 'violet',
  review: 'violet',
  'to-test': 'warn',
  test: 'warn',
  merge: 'ok',
  blocked: 'danger',
  done: 'muted',
}

/** A column a ticket can be forced into by hand (`POST /tickets/:key/force`), skipping the steps before it. */
export type ForceTarget = 'ready' | 'review' | 'to-test' | 'testing' | 'merge' | 'blocked' | 'done'

export interface ForceTargetDef {
  id: ForceTarget
  label: string
  column: ColumnId
}

/** The forced moves, in board order. Réalisation and En file are reached by starting the ticket. */
export const FORCE_TARGETS: readonly ForceTargetDef[] = [
  { id: 'ready', label: 'Prêtes', column: 'ready' },
  { id: 'review', label: 'Revue', column: 'review' },
  { id: 'to-test', label: 'À tester', column: 'to-test' },
  { id: 'testing', label: 'Test Unity', column: 'test' },
  { id: 'merge', label: 'À merger', column: 'merge' },
  { id: 'blocked', label: 'Bloquées', column: 'blocked' },
  { id: 'done', label: 'Faites', column: 'done' },
]

/** The forced moves offered for a ticket: every target but its own column. */
export function forceTargetsFor(ticket: Ticket): ForceTargetDef[] {
  const column = columnOf(ticket)
  return FORCE_TARGETS.filter((target) => target.column !== column)
}
