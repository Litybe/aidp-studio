import type { ColumnId, Ticket } from '../../api/types'
import { ACTIVE_FLOW } from '../board/TicketCard'
import { type Board, buildBoard, COLUMNS } from '../board/columns'

export interface Summary {
  board: Board
  /** Tickets whose flow is running or waiting (a decision, an external host). */
  active: Ticket[]
  /** Flows waiting for a human right now. */
  waiting: number
  counts: Record<ColumnId, number>
  total: number
}

export function summarize(tickets: readonly Ticket[]): Summary {
  const board = buildBoard(tickets)
  const counts = Object.fromEntries(COLUMNS.map((column) => [column.id, board[column.id].length])) as Record<ColumnId, number>
  const active = tickets.filter((ticket) => ticket.flowSummary && ACTIVE_FLOW.has(ticket.flowSummary.status))
  const waiting = active.filter((ticket) => ticket.flowSummary?.status === 'waiting_human').length
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return { board, active, waiting, counts, total }
}

/** Segments of the pipeline bar: the non-empty columns, width in percent of the visible tickets. */
export function pipelineSegments(summary: Summary): { id: ColumnId; label: string; count: number; percent: number }[] {
  if (summary.total === 0) return []
  return COLUMNS.filter((column) => summary.counts[column.id] > 0).map((column) => ({
    id: column.id,
    label: column.label,
    count: summary.counts[column.id],
    percent: (summary.counts[column.id] / summary.total) * 100,
  }))
}
