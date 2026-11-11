// Embedding model of the memory index: `GET/PATCH /api/memory/model` and the SSE `memory.model`.

export const MEMORY_MODEL_STATES = ['stopped', 'loading', 'running', 'error'] as const
export type MemoryModelState = (typeof MEMORY_MODEL_STATES)[number]

export interface MemoryModelChunks {
  total: number
  embedded: number
  stale: number
}

export interface MemoryModel {
  model: string
  installed: boolean
  state: MemoryModelState
  autostart: boolean
  dim: number | null
  ramBytes: number | null
  /** RFC 3339. */
  loadedAt: string | null
  error: string | null
  chunks: MemoryModelChunks
  path: string
}

/** `202` of `POST /api/memory/model/embed-pending`. */
export interface EmbedPendingReply {
  queued: boolean
}

/** Bus event type carrying a full {@link MemoryModel} as `data`. */
export const MEMORY_MODEL_EVENT = 'memory.model'

/** Error codes of the model routes. */
export const MODEL_MISSING = 'model_missing'
export const MODEL_STOPPED = 'model_stopped'

export function isMemoryModel(value: unknown): value is MemoryModel {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const chunks = record['chunks']
  return (
    typeof record['model'] === 'string' &&
    typeof record['installed'] === 'boolean' &&
    typeof record['state'] === 'string' &&
    (MEMORY_MODEL_STATES as readonly string[]).includes(record['state']) &&
    typeof chunks === 'object' &&
    chunks !== null
  )
}
