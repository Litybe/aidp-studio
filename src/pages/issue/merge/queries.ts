import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { apiGetText } from '../../../api/actions'
import { apiGet } from '../../../api/client'
import type { FlowRun, PrFileDiff, PrFilesPage } from '../../../api/types'
import { runIdsOf } from '../flowTimeline'
import { useAllRunFiles } from '../tabs'
import {
  type CriterionResult,
  foldResults,
  isResultFile,
  parseJsonText,
  resultsFromJson,
} from './criteria'

const NO_RETRY = { retry: false } as const

/**
 * PR files and diffs are keyed by the head SHA of the PR and live outside the SSE prefixes: a new
 * head gives a new key, the same head is never fetched twice (the daemon asks GitHub for each call).
 */
export const mergeKeys = {
  files: (repo: string, number: number, sha: string) => ['merge', 'files', repo, number, sha] as const,
  diff: (repo: string, number: number, sha: string, path: string) => ['merge', 'diff', repo, number, sha, path] as const,
  json: (runId: string, path: string) => ['merge', 'json', runId, path] as const,
}

const prQuery = (repo: string, number: number) => `repo=${encodeURIComponent(repo)}&number=${number}`

/** First page (100 files) of the PR, as of its head. */
export function usePrFiles(repo: string | undefined, number: number | undefined, sha: string | undefined) {
  const ready = Boolean(repo && number && sha)
  return useQuery({
    queryKey: mergeKeys.files(repo ?? '', number ?? 0, sha ?? ''),
    queryFn: ({ signal }) => apiGet<PrFilesPage>(`/prs/files?${prQuery(repo ?? '', number ?? 0)}`, signal),
    enabled: ready,
    ...NO_RETRY,
  })
}

/** The whole diff of one file, for the files the list came without a patch for. */
export function usePrFileDiff(
  repo: string | undefined,
  number: number | undefined,
  sha: string | undefined,
  path: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: mergeKeys.diff(repo ?? '', number ?? 0, sha ?? '', path),
    queryFn: ({ signal }) =>
      apiGet<PrFileDiff>(`/prs/file-diff?${prQuery(repo ?? '', number ?? 0)}&path=${encodeURIComponent(path)}`, signal),
    enabled: enabled && Boolean(repo && number && sha),
    ...NO_RETRY,
  })
}

/** Name of the step that started each run (`review:0:start_pipeline` gives `review`). */
function stepOfRuns(flow: FlowRun): Map<string, string> {
  const out = new Map<string, string>()
  for (const [effect, runId] of Object.entries(flow.sessions ?? {})) {
    if (typeof runId === 'string' && !out.has(runId)) out.set(runId, effect.split(':')[0] ?? effect)
  }
  return out
}

export interface CriteriaResults {
  results: Map<string, CriterionResult>
  /** Result files found; zero means no stage wrote a criterion result. */
  sources: number
  pending: boolean
}

/**
 * Criterion results of the whole flow: every `findings.json`, `review.json` and `playtest.json` of
 * its runs, read through the run files route, folded oldest run first (the latest answer wins).
 */
export function useCriteriaResults(flow: FlowRun): CriteriaResults {
  const runIds = useMemo(() => [...runIdsOf(flow)].sort(), [flow])
  const steps = useMemo(() => stepOfRuns(flow), [flow])
  const listing = useAllRunFiles(runIds, true)
  const wanted = useMemo(
    () =>
      listing.files
        .filter((file) => file.kind === 'json' && isResultFile(file.path))
        .sort((a, b) => a.runId.localeCompare(b.runId) || a.path.localeCompare(b.path)),
    [listing.files],
  )
  const reads = useQueries({
    queries: wanted.map((file) => ({
      queryKey: mergeKeys.json(file.runId, file.path),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGetText(`/runs/${encodeURIComponent(file.runId)}/files/${file.path.split('/').map(encodeURIComponent).join('/')}`, signal),
      ...NO_RETRY,
    })),
  })
  const ordered: CriterionResult[] = []
  let sources = 0
  reads.forEach((read, index) => {
    const file = wanted[index]
    if (!file || read.data === undefined) return
    const found = resultsFromJson(parseJsonText(read.data), `${steps.get(file.runId) ?? 'run'} · ${file.path}`)
    if (found.length > 0) sources += 1
    ordered.push(...found)
  })
  return {
    results: foldResults(ordered),
    sources,
    pending: listing.pending || reads.some((read) => read.isPending),
  }
}
