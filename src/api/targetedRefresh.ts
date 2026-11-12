import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { apiGet } from './client'
import { f1Keys } from './f1queries'
import { queryKeys } from './queries'
import type { Ticket, TicketDetail } from './types'

const TICKET_OR_FLOW_PATH = /^\/(tickets|flows)\/([^/?]+)\//
const QUEUE_PATH = /^\/queue\//
const DISPATCHER_PATH = /^\/dispatcher\//

/** The ticket an action path names: `/tickets/<key>/…` or `/flows/<key>/…` (a flow key is its ticket key). */
export function ticketOfPath(path: string): string | null {
  const match = TICKET_OR_FLOW_PATH.exec(path)
  return match?.[2] ? decodeURIComponent(match[2]) : null
}

/** The queries of one ticket: its detail, cost, PR and flow (journal and doctor included). */
export function ticketKeys(key: string): QueryKey[] {
  return [f1Keys.ticket(key), f1Keys.cost(key), f1Keys.pr(key), queryKeys.flow(key)]
}

/** Re-reads one ticket and patches it into the board list, so the other cards are not refetched. */
export async function refreshTicket(client: QueryClient, key: string): Promise<void> {
  for (const queryKey of ticketKeys(key)) void client.invalidateQueries({ queryKey })
  const list = client.getQueryData<Ticket[]>(f1Keys.tickets)
  if (!list) return
  try {
    const detail = await apiGet<TicketDetail>(`/tickets/${encodeURIComponent(key)}`)
    client.setQueryData<Ticket[]>(f1Keys.tickets, (current) => {
      if (!current) return current
      const known = current.some((ticket) => ticket.key === key)
      return known ? current.map((ticket) => (ticket.key === key ? detail.ticket : ticket)) : [...current, detail.ticket]
    })
  } catch {
    void client.invalidateQueries({ queryKey: f1Keys.tickets, exact: true })
  }
}

/** After a successful POST: refreshes only what that action touched; other actions leave the cache to SSE. */
export function refreshAfterAction(path: string, client: QueryClient): void {
  const ticket = ticketOfPath(path)
  if (ticket) {
    void refreshTicket(client, ticket)
    void client.invalidateQueries({ queryKey: f1Keys.queue, exact: true })
    return
  }
  if (QUEUE_PATH.test(path)) void client.invalidateQueries({ queryKey: f1Keys.queue, exact: true })
  else if (DISPATCHER_PATH.test(path)) void client.invalidateQueries({ queryKey: queryKeys.dispatcher })
}
