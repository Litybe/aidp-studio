import type { Ticket } from '../../api/types'
import { flowIconStatus, type IconStatus } from '../../lib/status'
import { columnOf } from './columns'

/** The status icon of a ticket, from its column and its flow summary (nothing is fetched). */
export function ticketIconStatus(ticket: Ticket): IconStatus {
  const column = columnOf(ticket)
  if (column === 'done') return 'success'
  if (column === 'blocked') return 'failure'
  if (column === 'merge' || column === 'triage') return 'human'
  const flow = ticket.flowSummary ? flowIconStatus(ticket.flowSummary.status) : 'pending'
  if (flow !== 'pending') return flow
  return column === 'realisation' || column === 'review' || column === 'test' ? 'running' : 'pending'
}
