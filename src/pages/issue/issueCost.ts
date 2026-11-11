import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { queryKeys } from '../../api/queries'

/** Token counters and dollars of one slice of work. */
export interface CostAmount {
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  totalTokens: number
  costUsd: number
}

export interface StageCost extends CostAmount {
  stage: string
  agent: string | null
  model: string | null
}

export interface PixellabRun {
  runId: string
  generations: number
  spent: number | null
}

export interface RunCost extends CostAmount {
  runId: string
  pipelineId: string
  startedAt: string
  stages: StageCost[]
  pixellab: PixellabRun | null
}

export interface CostGroup extends CostAmount {
  key: string
  count: number
}

/** `GET /api/tickets/:key/cost/detail`. */
export interface IssueCost {
  key: string
  totals: CostAmount
  runs: RunCost[]
  byStage: CostGroup[]
  byAgent: CostGroup[]
  sessions: CostAmount
  sessionCount: number
  pixellab: { generations: number; credits: number | null } | null
}

export function useIssueCost(key: string) {
  return useQuery({
    queryKey: [...queryKeys.tickets, 'issue-cost', key] as const,
    queryFn: ({ signal }) => apiGet<IssueCost>(`/tickets/${encodeURIComponent(key)}/cost/detail`, signal),
    retry: false,
  })
}
