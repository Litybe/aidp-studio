import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ConnectionState } from './events'
import type { Realtime } from './runtime'

/** Holds a value that never changes: providing it re-renders nothing. */
export const RealtimeContext = createContext<Realtime | null>(null)

export function useRealtime(): Realtime {
  const realtime = useContext(RealtimeContext)
  if (!realtime) throw new Error('RealtimeContext is missing')
  return realtime
}

/** A narrow slice of the connection state; return a primitive so unrelated changes do not re-render. */
export function useConnection<T>(select: (state: ConnectionState) => T): T {
  const { stream } = useRealtime()
  return useSyncExternalStore(stream.state.subscribe, () => select(stream.state.getSnapshot()))
}

/** A value derived from the 1 Hz clock; return a primitive (a label) so it re-renders only when it changes. */
export function useTicker<T>(select: (nowMs: number) => T): T {
  const { ticker } = useRealtime()
  return useSyncExternalStore(ticker.subscribe, () => select(ticker.getSnapshot()))
}
