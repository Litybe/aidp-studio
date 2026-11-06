import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { apiSend, retryOptional } from '../../api/send'
import type { Memory, MemoryPatch, RagHit, ReindexResult } from '../../api/types/memory'
import { asList } from '../../lib/format'

export interface MemoryFilter {
  status: string
  kind: string
  q: string
}

function queryString(params: Record<string, string>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== '') search.set(key, value)
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

/** `GET /api/memory?status=&kind=&q=` (C11, P6). `SSE memory.*` invalidates the `['memory']` family. */
export function useMemories(filter: MemoryFilter) {
  return useQuery({
    queryKey: f2Keys.memoryList(filter.status, filter.kind, filter.q),
    queryFn: ({ signal }) => apiGet<unknown>(`/memory${queryString({ ...filter })}`, signal),
    select: (body) => asList<Memory>(body),
    retry: retryOptional,
  })
}

/** Number of proposals waiting for approval: the sidebar badge. */
export function useProposedCount() {
  return useQuery({
    queryKey: f2Keys.memoryProposed,
    queryFn: ({ signal }) => apiGet<unknown>('/memory?status=proposed', signal),
    select: (body) => asList<Memory>(body).length,
    retry: retryOptional,
  })
}

/** `GET /api/rag/search?q=&source=&budget=`; runs only once a query was submitted. */
export function useRagSearch(q: string, source: string) {
  return useQuery({
    queryKey: f2Keys.ragSearch(q, source),
    queryFn: ({ signal }) => apiGet<unknown>(`/rag/search${queryString({ q, source })}`, signal),
    select: (body) => asList<RagHit>(body),
    enabled: q.trim() !== '',
    retry: retryOptional,
  })
}

function useMemoryMutation<V>(send: (value: V) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: f2Keys.memory }),
  })
}

export const useApprove = () => useMemoryMutation((id: string) => apiSend('POST', `/memory/${encodeURIComponent(id)}/approve`))
export const useArchive = () => useMemoryMutation((id: string) => apiSend('POST', `/memory/${encodeURIComponent(id)}/archive`))
export const useMerge = () =>
  useMemoryMutation(({ id, into }: { id: string; into: string }) => apiSend('POST', `/memory/${encodeURIComponent(id)}/merge`, { into }))
export const useEditMemory = () =>
  useMemoryMutation(({ id, patch }: { id: string; patch: MemoryPatch }) => apiSend('PATCH', `/memory/${encodeURIComponent(id)}`, patch))

/** `POST /api/rag/reindex`. */
export function useReindex() {
  return useMutation({ mutationFn: () => apiSend<ReindexResult | undefined>('POST', '/rag/reindex') })
}

/** `path:L12-30`, from `lines` as `[12, 30]` or `"12-30"`; the bare path when there is none. */
export function citation(hit: Pick<RagHit, 'path' | 'lines'>): string {
  const { lines } = hit
  if (Array.isArray(lines)) return `${hit.path}:L${lines[0]}-${lines[1]}`
  if (typeof lines === 'string' && lines !== '') return `${hit.path}:L${lines.replace(/^L/, '')}`
  return hit.path
}

export const KIND_LABEL: Record<string, string> = {
  decision: 'décision',
  convention: 'convention',
  lesson: 'leçon',
  gotcha: 'piège',
  preference: 'préférence',
  fact: 'fait',
}

export const STATUS_LABEL: Record<string, string> = {
  proposed: 'proposée',
  active: 'active',
  stale: 'périmée',
  archived: 'archivée',
  superseded: 'remplacée',
}
