import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { f2Keys } from '../../api/f2Keys'
import { apiSend, retryOptional, withoutSaveFlags } from '../../api/send'
import type { SaveFlags } from '../../api/types/budget'
import type { CatalogFlow, CatalogTemplate, DispatcherSlots, ModelPolicy, ModelsSettings, RoutingSettings } from '../../api/types/settings'
import { asList } from '../../lib/format'

export type SettingsName = 'routing' | 'models'

/** `GET /api/settings/routing|models` (C11, F2 daemon). A 404 means the daemon predates F2. */
export function useSetting<T>(name: SettingsName) {
  return useQuery({
    queryKey: f2Keys.settings(name),
    queryFn: ({ signal }) => apiGet<T>(`/settings/${name}`, signal),
    retry: retryOptional,
  })
}

/**
 * `PUT /api/settings/<name>`: validated by the daemon before it writes; a `400` lists the faulty paths.
 * The reply has the shape of the `GET` plus {@link SaveFlags}; `settings.changed` refreshes the other readers.
 */
export function useSaveSetting<T extends object, Body = T>(name: SettingsName) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Body) => apiSend<T & SaveFlags>('PUT', `/settings/${name}`, body),
    onSuccess: (saved) => client.setQueryData(f2Keys.settings(name), withoutSaveFlags(saved)),
  })
}

export const useRouting = () => useSetting<RoutingSettings>('routing')
export const useModels = () => useSetting<ModelsSettings>('models')
export const useSaveRouting = () => useSaveSetting<RoutingSettings>('routing')
export const useSaveModels = () => useSaveSetting<ModelsSettings, { models: ModelPolicy }>('models')

export function useCatalog<T extends { id: string }>(name: 'flows' | 'templates') {
  return useQuery({
    queryKey: f2Keys.catalog(name),
    queryFn: ({ signal }) => apiGet<unknown>(`/catalog/${name}`, signal),
    select: (body) => asList<T>(body),
    retry: retryOptional,
  })
}

export const useCatalogFlows = () => useCatalog<CatalogFlow>('flows')
export const useCatalogTemplates = () => useCatalog<CatalogTemplate>('templates')

/** Slots of the dispatcher (`GET /api/dispatcher`). */
export function useSlots() {
  return useQuery({
    queryKey: f2Keys.dispatcherSlots,
    queryFn: ({ signal }) => apiGet<{ slots?: DispatcherSlots }>('/dispatcher', signal),
    select: (body) => body.slots ?? null,
    retry: retryOptional,
  })
}
