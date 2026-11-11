import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { apiSend, retryOptional } from '../../api/send'
import type { EmbedPendingReply, MemoryModel } from '../../api/types/memoryModel'

/** DOM id of the card: the target of the header indicator's link. */
export const MODEL_CARD_ID = 'embeddings-model'

const MODEL_PATH = '/memory/model'

/** `GET /api/memory/model`. Kept fresh by the SSE `memory.model` (the stream writes the cache), never polled. */
export function useMemoryModel() {
  return useQuery({
    queryKey: f2Keys.memoryModel,
    queryFn: ({ signal }) => apiGet<MemoryModel>(MODEL_PATH, signal),
    retry: retryOptional,
  })
}

function useModelMutation<V>(send: (value: V) => Promise<MemoryModel>, optimistic?: (current: MemoryModel) => MemoryModel) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: send,
    onMutate: () => {
      const previous = client.getQueryData<MemoryModel>(f2Keys.memoryModel)
      if (previous && optimistic) client.setQueryData(f2Keys.memoryModel, optimistic(previous))
      return { previous }
    },
    onSuccess: (reply) => client.setQueryData(f2Keys.memoryModel, reply),
    onError: (_error, _value, context) => {
      if (context?.previous) client.setQueryData(f2Keys.memoryModel, context.previous)
      void client.invalidateQueries({ queryKey: f2Keys.memoryModel })
    },
  })
}

export const useStartModel = () =>
  useModelMutation(
    () => apiSend<MemoryModel>('POST', `${MODEL_PATH}/start`),
    (current) => ({ ...current, state: 'loading', error: null }),
  )

export const useStopModel = () =>
  useModelMutation(
    () => apiSend<MemoryModel>('POST', `${MODEL_PATH}/stop`),
    (current) => ({ ...current, state: 'stopped' }),
  )

export const useSetAutostart = () => useModelMutation((autostart: boolean) => apiSend<MemoryModel>('PATCH', MODEL_PATH, { autostart }))

/** `POST /api/memory/model/embed-pending`; the progress arrives through `memory.model`. */
export function useEmbedPending() {
  return useMutation({ mutationFn: () => apiSend<EmbedPendingReply>('POST', `${MODEL_PATH}/embed-pending`) })
}

export const STATE_LABEL = {
  stopped: 'Arrêté',
  loading: 'Chargement…',
  running: 'Actif',
  error: 'Erreur',
} as const

export const INSTALL_REPO = 'https://huggingface.co/minishlab/potion-multilingual-128M'

export function installCommand(path: string): string {
  return `git clone ${INSTALL_REPO} ${path}`
}

const GIGABYTE = 1024 * 1024 * 1024
const MEGABYTE = 1024 * 1024

/** `512 Mo`, `1,2 Go`. */
export function formatRam(bytes: number): string {
  if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`
  return `${Math.round(bytes / MEGABYTE).toLocaleString('fr-FR')} Mo`
}

/** Share of embedded chunks, 0 to 100. */
export function embeddedPercent(embedded: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((embedded / total) * 100))
}
