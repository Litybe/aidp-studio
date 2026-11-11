import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { fetchEventToken, onTokenChange } from '../api/auth'
import { f2Keys } from '../api/f2Keys'
import { statusQuery } from '../api/queries'
import { isMemoryModel, MEMORY_MODEL_EVENT } from '../api/types/memoryModel'
import { Ticker } from '../lib/ticker'
import { documentVisibility, type VisibilitySource } from '../lib/visibility'
import { EventStream } from './events'
import { InvalidationBatcher, keysForEvent } from './invalidation'

/** The realtime services of the app: created once, outside React, never re-rendering the tree. */
export interface Realtime {
  stream: EventStream
  ticker: Ticker
  batcher: InvalidationBatcher
}

/** The empty key prefixes every query: a resync invalidates the whole cache, through the batcher. */
const EVERY_QUERY: QueryKey = []

export function createRealtime(queryClient: QueryClient, visibility: VisibilitySource = documentVisibility): Realtime {
  const batcher = new InvalidationBatcher((keys) => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
  }, visibility)
  const stream = new EventStream({
    probe: () => queryClient.fetchQuery({ ...statusQuery, staleTime: 0 }),
    onEvent: (event) => {
      if (event.type === MEMORY_MODEL_EVENT) {
        if (isMemoryModel(event.data)) queryClient.setQueryData(f2Keys.memoryModel, event.data)
        else batcher.add([f2Keys.memoryModel])
        return
      }
      batcher.add(keysForEvent(event))
    },
    onResync: () => batcher.add([EVERY_QUERY]),
    onOpen: () => {
      const failed = queryClient
        .getQueryCache()
        .findAll({ predicate: (query) => query.state.status === 'error' })
        .map((query) => query.queryKey)
      batcher.add(failed)
    },
    getStreamToken: fetchEventToken,
    visibility,
  })
  onTokenChange(() => {
    batcher.add([EVERY_QUERY])
    stream.retryNow()
  })
  return { stream, batcher, ticker: new Ticker(visibility) }
}
