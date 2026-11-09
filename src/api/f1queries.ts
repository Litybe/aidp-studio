import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { isNotFound } from './actions'
import { apiGet } from './client'
import { countInbox, queryKeys } from './queries'
import type {
  FlowDoctor,
  FlowRun,
  InboxEntry,
  JournalLine,
  QueueEntry,
  RunDetail,
  RunFile,
  SessionInfo,
  Ticket,
  TicketCost,
  TicketDetail,
  TicketPr,
} from './types'

/** Keys under `['tickets']`/`['runs']`/`['flow']`, so the SSE prefixes already invalidate them. */
export const f1Keys = {
  tickets: [...queryKeys.tickets, 'list'] as const,
  ticket: (key: string) => [...queryKeys.tickets, 'one', key] as const,
  cost: (key: string) => [...queryKeys.tickets, 'cost', key] as const,
  pr: (key: string) => [...queryKeys.tickets, 'pr', key] as const,
  journal: (key: string) => [...queryKeys.flow(key), 'journal'] as const,
  doctor: (key: string) => [...queryKeys.flow(key), 'doctor'] as const,
  queue: [...queryKeys.queue, 'list'] as const,
  runFiles: (id: string) => [...queryKeys.runs, 'files', id] as const,
  runFile: (id: string, path: string) => [...queryKeys.runs, 'file', id, path] as const,
  run: (id: string) => [...queryKeys.runs, 'detail', id] as const,
  session: (id: string) => [...queryKeys.sessions, 'one', id] as const,
  capabilities: ['capabilities'] as const,
}

/** Optional (C11) routes never retry: a 404 settles at once. */
const NO_RETRY = { retry: false } as const

export function useTickets() {
  return useQuery({
    queryKey: f1Keys.tickets,
    queryFn: ({ signal }) => apiGet<Ticket[]>('/tickets', signal),
  })
}

export function useTicket(key: string) {
  return useQuery({
    queryKey: f1Keys.ticket(key),
    queryFn: ({ signal }) => apiGet<TicketDetail>(`/tickets/${encodeURIComponent(key)}`, signal),
  })
}

export function useFlow(key: string) {
  return useQuery({
    queryKey: queryKeys.flow(key),
    queryFn: ({ signal }) => apiGet<FlowRun>(`/flows/${encodeURIComponent(key)}`, signal),
    retry: (failures, error) => !isNotFound(error) && failures < 2,
  })
}

export function useJournal(key: string, enabled: boolean) {
  return useQuery({
    queryKey: f1Keys.journal(key),
    queryFn: async ({ signal }) => {
      const body = await apiGet<JournalLine[] | { entries: JournalLine[] }>(
        `/flows/${encodeURIComponent(key)}/journal`,
        signal,
      )
      return Array.isArray(body) ? body : body.entries
    },
    enabled,
    ...NO_RETRY,
  })
}

/** Incidents of the pipeline doctor; a daemon without the route (404, 503) settles at once. */
export function useFlowDoctor(key: string) {
  return useQuery({
    queryKey: f1Keys.doctor(key),
    queryFn: ({ signal }) => apiGet<FlowDoctor>(`/flows/${encodeURIComponent(key)}/doctor`, signal),
    ...NO_RETRY,
  })
}

export function useQueue() {
  return useQuery({
    queryKey: f1Keys.queue,
    queryFn: ({ signal }) => apiGet<QueueEntry[]>('/queue', signal),
  })
}

export function useInbox() {
  return useQuery({
    queryKey: queryKeys.inbox,
    queryFn: ({ signal }) => apiGet<InboxEntry[]>('/inbox', signal),
  })
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: f1Keys.session(id ?? ''),
    queryFn: ({ signal }) => apiGet<SessionInfo>(`/sessions/${encodeURIComponent(id ?? '')}`, signal),
    enabled: id !== null,
    ...NO_RETRY,
  })
}

const COST_MISSING = [...f1Keys.capabilities, 'cost-missing'] as const

export function markCostMissing(client: QueryClient): void {
  client.setQueryData(COST_MISSING, true)
}

/**
 * Cost of one ticket (T1). The first 404 marks the route missing for the whole app, so the other
 * cards stop asking.
 */
export function useTicketCost(key: string) {
  const client = useQueryClient()
  const missing = useQuery({
    queryKey: COST_MISSING,
    queryFn: () => false,
    enabled: false,
    initialData: false,
  }).data
  return useQuery({
    queryKey: f1Keys.cost(key),
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<TicketCost>(`/tickets/${encodeURIComponent(key)}/cost`, signal)
      } catch (error) {
        if (isNotFound(error)) markCostMissing(client)
        throw error
      }
    },
    enabled: !missing,
    ...NO_RETRY,
  })
}

export function useTicketPr(key: string, enabled: boolean) {
  return useQuery({
    queryKey: f1Keys.pr(key),
    queryFn: ({ signal }) => apiGet<TicketPr>(`/tickets/${encodeURIComponent(key)}/pr`, signal),
    enabled,
    ...NO_RETRY,
  })
}

export function useRunFiles(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: f1Keys.runFiles(runId),
    queryFn: ({ signal }) => apiGet<RunFile[]>(`/runs/${encodeURIComponent(runId)}/files`, signal),
    enabled,
    ...NO_RETRY,
  })
}

export function useRunDetail(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: f1Keys.run(runId),
    queryFn: ({ signal }) => apiGet<RunDetail>(`/runs/${encodeURIComponent(runId)}`, signal),
    enabled,
    ...NO_RETRY,
  })
}

/** Blocked tickets that count in the inbox: the badge and the page read the same rule. */
export function isBlockedStatus(status: string): boolean {
  return status === 'blocked' || status.startsWith('blocked:')
}

/** Inbox badge: entries waiting for a decision plus blocked issues. */
export function useInboxTotal(): number {
  const entries = useQuery({
    queryKey: queryKeys.inbox,
    queryFn: ({ signal }) => apiGet<InboxEntry[]>('/inbox', signal),
    select: countInbox,
  }).data
  const blocked = useQuery({
    queryKey: f1Keys.tickets,
    queryFn: ({ signal }) => apiGet<Ticket[]>('/tickets', signal),
    select: (tickets: Ticket[]) => tickets.filter((ticket) => isBlockedStatus(ticket.status)).length,
  }).data
  return (entries ?? 0) + (blocked ?? 0)
}
