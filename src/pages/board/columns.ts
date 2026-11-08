import type { ColumnId, Ticket, TicketRoute } from '../../api/types'

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

export interface Filters {
  route: TicketRoute | ''
  milestone: string
  label: string
}

export const NO_FILTERS: Filters = { route: '', milestone: '', label: '' }

export function matchesFilters(ticket: Ticket, filters: Filters): boolean {
  if (filters.route && routeOf(ticket) !== filters.route) return false
  if (filters.milestone && (ticket.milestone?.title ?? '') !== filters.milestone) return false
  if (filters.label && !(ticket.labels ?? []).includes(filters.label)) return false
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
