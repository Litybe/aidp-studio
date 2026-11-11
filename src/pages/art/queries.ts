import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { retryOptional } from '../../api/send'
import type { ArtAssetsPage, ArtTicket } from '../../api/types/art'
import { asList } from '../../lib/format'

/** Tickets of the art route (`route` comes with P2 in `GET /api/tickets`); they give the titles. */
export function useArtTickets() {
  return useQuery({
    queryKey: f2Keys.artTickets,
    queryFn: ({ signal }) => apiGet<unknown>('/tickets', signal),
    select: (body) => asList<ArtTicket>(body).filter((ticket) => ticket.route === 'art'),
    retry: retryOptional,
  })
}

export interface ArtFilters {
  status: string
  issue: string
  q: string
}

export const PAGE_SIZE = 24

/** Query string of `GET /api/art/assets`; empty filters are left out. */
export function assetsPath(filters: ArtFilters, before: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (before) params.set('before', before)
  if (filters.status) params.set('status', filters.status)
  if (filters.issue) params.set('issue', filters.issue)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  return `/art/assets?${params.toString()}`
}

/** Every sprite run (finished or not), newest first, loaded page by page. */
export function useArtAssets(filters: ArtFilters) {
  return useInfiniteQuery({
    queryKey: ['art', 'assets', filters.status, filters.issue, filters.q.trim()] as const,
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) => apiGet<ArtAssetsPage>(assetsPath(filters, pageParam), signal),
    getNextPageParam: (last) => last.next,
    retry: retryOptional,
  })
}
