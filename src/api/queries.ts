import { QueryClient, useQuery } from '@tanstack/react-query'
import { apiGet, isUnreachable } from './client'
import type { DispatcherBudget, GatewayStatus, InboxEntry, Project, RateLimitSnapshot } from './types'

/** Every query key of the app. Prefix keys (`budget`) invalidate all the queries they start. */
export const queryKeys = {
  gatewayStatus: ['gateway', 'status'] as const,
  budget: ['budget'] as const,
  dispatcherBudget: ['budget', 'dispatcher'] as const,
  rateLimitHistory: ['budget', 'rate-limit'] as const,
  dispatcher: ['dispatcher'] as const,
  inbox: ['inbox'] as const,
  projects: ['projects'] as const,
  tickets: ['tickets'] as const,
  flows: ['flows'] as const,
  flow: (key: string) => ['flow', key] as const,
  sessions: ['sessions'] as const,
  queue: ['queue'] as const,
  usage: ['usage'] as const,
  prs: ['prs'] as const,
  automations: ['automations'] as const,
  runs: ['runs'] as const,
  worktrees: ['worktrees'] as const,
  presets: ['presets'] as const,
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000
/**
 * Unused data stays 30 min: a tab switch renders from the cache at once. SSE invalidations keep it
 * fresh (an inactive query invalidated is refetched on its next mount; a fresh one is not).
 */
const GC_TIME_MS = 30 * 60_000

/** Data lives by the SSE stream: never stale on its own, no polling, no refetch on focus. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: GC_TIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: true,
        retry: (failures, error) => !isUnreachable(error) && failures < MAX_RETRIES,
        retryDelay: RETRY_DELAY_MS,
      },
    },
  })
}

export const statusQuery = {
  queryKey: queryKeys.gatewayStatus,
  queryFn: ({ signal }: { signal: AbortSignal }) => apiGet<GatewayStatus>('/gateway/status', signal),
}

export function useGatewayStatus<T>(select: (status: GatewayStatus) => T) {
  return useQuery({ ...statusQuery, select })
}

export const dispatcherBudgetQuery = {
  queryKey: queryKeys.dispatcherBudget,
  queryFn: ({ signal }: { signal: AbortSignal }) => apiGet<DispatcherBudget>('/dispatcher/budget', signal),
}

export function useDispatcherBudget<T>(select: (budget: DispatcherBudget) => T) {
  return useQuery({ ...dispatcherBudgetQuery, select })
}

/** The last persisted snapshot, read only when the daemon has no live one. */
export function useLastRateLimit(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.rateLimitHistory,
    queryFn: ({ signal }) => apiGet<RateLimitSnapshot[]>('/usage/rate-limit?limit=1', signal),
    select: (history: RateLimitSnapshot[]) => history[0] ?? null,
    enabled,
  })
}

/** Kinds that wait for a decision; a plain running session does not. */
export function needsDecision(entry: InboxEntry): boolean {
  return entry.kind !== 'runningSession'
}

export function countInbox(entries: InboxEntry[]): number {
  return entries.filter(needsDecision).length
}

export function useInboxCount() {
  return useQuery({
    queryKey: queryKeys.inbox,
    queryFn: ({ signal }) => apiGet<InboxEntry[]>('/inbox', signal),
    select: countInbox,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiGet<Project[]>('/projects', signal),
  })
}

/** `GET /api/dispatcher`: the persisted dispatcher state (camelCase). */
export interface DispatcherState {
  mode: 'normal' | 'waiting' | 'paused' | string
  paused: boolean
  waitUntil: string | null
  lastTickAt: string
  lastReason: string
  slots: { used: number; max: number; testUsed: number; testMax: number }
  running: { key: string; sessionId: string; project: string; startedAt: string }[]
}

export function useDispatcherState<T>(select: (state: DispatcherState) => T) {
  return useQuery({
    queryKey: queryKeys.dispatcher,
    queryFn: ({ signal }) => apiGet<DispatcherState>('/dispatcher', signal),
    select,
  })
}

/** Manual pause (state) or budget pause (verdict). */
export function useDispatcherPaused(): boolean {
  const manual = useDispatcherState(selectStatePaused).data === true
  const budget = useDispatcherBudget(selectBudgetPaused).data === true
  return manual || budget
}

const selectStatePaused = (state: DispatcherState) => state.paused
const selectBudgetPaused = (budget: DispatcherBudget) => budget.verdict.verdict === 'paused'
