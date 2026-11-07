import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { apiSend, retryOptional, withoutSaveFlags } from '../../api/send'
import type { BudgetSettings, BudgetUpdate, CostAnomaly, PixellabBalance, SaveFlags, UsageBucket, UsageGroupBy, UsageResponse } from '../../api/types/budget'
import type { BarItem } from '../../components/BarChart'
import { asList } from '../../lib/format'

const DAY_MS = 86_400_000
/** Window of the usage charts. */
export const USAGE_DAYS = 30

/** `YYYY-MM-DD` of `days` days ago (UTC); the daemon expands a bare date to midnight UTC. */
export function sinceDate(days: number, nowMs: number): string {
  return new Date(nowMs - days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * `GET /api/usage?groupBy=`. `route`, `stage`, `model` and `ticket` come with P5 (T1): until then the
 * daemon answers `400` or `404`, which the page shows as « bientôt disponible ».
 */
export function useUsage(groupBy: UsageGroupBy, from: string) {
  return useQuery({
    queryKey: f2Keys.usageBy(groupBy, from),
    queryFn: ({ signal }) => apiGet<UsageResponse>(`/usage?groupBy=${groupBy}&from=${from}`, signal),
    retry: retryOptional,
  })
}

export function usePixellabBalance() {
  return useQuery({
    queryKey: f2Keys.pixellab,
    queryFn: ({ signal }) => apiGet<PixellabBalance>('/pixellab/balance', signal),
    retry: retryOptional,
  })
}

export function useAnomalies() {
  return useQuery({
    queryKey: f2Keys.budgetAnomalies,
    queryFn: ({ signal }) => apiGet<unknown>('/cost/anomalies', signal),
    select: (body) => asList<CostAnomaly>(body),
    retry: retryOptional,
  })
}

export function useBudgetSettings() {
  return useQuery({
    queryKey: f2Keys.settings('budget'),
    queryFn: ({ signal }) => apiGet<BudgetSettings>('/settings/budget', signal),
    retry: retryOptional,
  })
}

/** `PUT /api/settings/budget`: any subset of the keys; the daemon checks them before it writes, and a `400` lists the faulty paths. */
export function useSaveBudget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (update: BudgetUpdate) => apiSend<BudgetSettings & SaveFlags>('PUT', '/settings/budget', update),
    onSuccess: (saved) => client.setQueryData(f2Keys.settings('budget'), withoutSaveFlags(saved)),
  })
}

/** Bars from buckets: the label is the bucket's own, or its key. */
export function bucketBars(buckets: readonly UsageBucket[], limit = 12): BarItem[] {
  return buckets.slice(0, limit).map((bucket) => ({ label: bucket.label ?? bucket.key, value: bucket.totalTokens }))
}

/** Per-day bars keep the order of the daemon (ascending dates), cut to the last `limit` days. */
export function dayBars(buckets: readonly UsageBucket[], limit = 14): BarItem[] {
  return bucketBars(buckets.slice(-limit), limit)
}

/** The most expensive buckets first, whatever the order the daemon used. */
export function topBuckets(buckets: readonly UsageBucket[], limit = 8): UsageBucket[] {
  return [...buckets].sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key)).slice(0, limit)
}

/** `3 000 000` tokens <-> `3` (millions) in the form. */
export const toMillions = (tokens: number | undefined): string => (tokens === undefined ? '' : String(tokens / 1_000_000))
export const fromMillions = (text: string): number | undefined => {
  const value = Number(text.replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(value) ? undefined : Math.round(value * 1_000_000)
}
