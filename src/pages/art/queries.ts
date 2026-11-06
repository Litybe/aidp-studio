import { useQueries, useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { retryOptional } from '../../api/send'
import type { ArtImage, ArtTicket, FlowSessions, RunFile } from '../../api/types/art'
import { asList } from '../../lib/format'

/** Tickets of the art route (`route` comes with P2 in `GET /api/tickets`). */
export function useArtTickets() {
  return useQuery({
    queryKey: f2Keys.artTickets,
    queryFn: ({ signal }) => apiGet<unknown>('/tickets', signal),
    select: (body) => asList<ArtTicket>(body).filter((ticket) => ticket.route === 'art'),
    retry: retryOptional,
  })
}

/** Native run ids named by `GET /api/flows/:key` (`sessions` maps an effect id to a run or session id). */
export function runIdsOf(flow: FlowSessions | undefined): string[] {
  return [...new Set(Object.values(flow?.sessions ?? {}).filter((id) => typeof id === 'string' && id !== ''))]
}

/** `/api/runs/<id>/files/<path>`, each segment of the path encoded. */
export function runFileUrl(runId: string, path: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/files/${path.split('/').map(encodeURIComponent).join('/')}`
}

export const isImage = (file: RunFile): boolean => file.kind === 'png' || file.kind === 'gif'

/**
 * The images of one issue: flow of the ticket, then `GET /api/runs/:id/files` for each run id it names.
 * Loaded only once the issue is opened. A session id (not a run) answers 404 and is skipped.
 */
export function useIssueImages(ticket: ArtTicket, enabled: boolean) {
  const flowKey = ticket.flowSummary?.flowKey ?? null
  const flow = useQuery({
    queryKey: ['flows', 'art', ticket.key],
    queryFn: ({ signal }) => apiGet<FlowSessions>(`/flows/${encodeURIComponent(flowKey ?? '')}`, signal),
    enabled: enabled && flowKey !== null,
    retry: retryOptional,
  })
  const runIds = runIdsOf(flow.data)
  const files = useQueries({
    queries: runIds.map((runId) => ({
      queryKey: [...f2Keys.artFiles(ticket.key), runId],
      queryFn: ({ signal }: { signal: AbortSignal }) => apiGet<unknown>(`/runs/${encodeURIComponent(runId)}/files`, signal),
      retry: false,
    })),
  })
  const images: ArtImage[] = []
  files.forEach((result, index) => {
    const runId = runIds[index]
    if (runId === undefined || result.data === undefined) return
    for (const file of asList<RunFile>(result.data)) if (isImage(file)) images.push({ runId, file })
  })
  const loading = flow.isPending && flowKey !== null && enabled ? true : files.some((result) => result.isPending)
  return { images, loading, flow, noFlow: flowKey === null }
}
