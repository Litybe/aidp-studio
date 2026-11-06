import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { f2Keys } from '../../api/f2Keys'
import { apiGet } from '../../api/client'
import { apiSend, retryOptional } from '../../api/send'
import type { UnityStatus } from '../../api/types/unity'

/** `GET /api/unity/status` (C3). A 404 means the daemon predates P3: the callers show « bientôt disponible ». */
export function useUnityStatus() {
  return useQuery({
    queryKey: f2Keys.unityStatus,
    queryFn: ({ signal }) => apiGet<UnityStatus>('/unity/status', signal),
    retry: retryOptional,
  })
}

/** `POST /api/unity/lock/release`: frees an orphan lock. */
export function useReleaseLock() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiSend<unknown>('POST', '/unity/lock/release'),
    onSuccess: () => client.invalidateQueries({ queryKey: f2Keys.unity }),
  })
}

/** `GH-214` becomes `#214`; anything else is kept as is. */
export function ticketLabel(ticketKey: string): string {
  const match = /^GH-(\d+)$/.exec(ticketKey)
  return match ? `#${match[1]}` : ticketKey
}

/** Short text of the top bar: `ouvert, verrou #214`, `ouvert`, `fermé`. */
export function unitySummary(status: UnityStatus): { text: string; tone: 'ok' | 'muted' } {
  if (!status.editor.running) return { text: 'fermé', tone: 'muted' }
  const holder = status.lock.held ? status.lock.holder : null
  if (holder) return { text: `ouvert, verrou ${ticketLabel(holder.ticketKey)}`, tone: 'ok' }
  return { text: status.lock.held ? 'ouvert, verrou pris' : 'ouvert', tone: 'ok' }
}
