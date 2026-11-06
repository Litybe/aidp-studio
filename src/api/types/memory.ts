// C10 of gamedev-contracts.md: memory object and RAG search.

export const MEMORY_KINDS = ['decision', 'convention', 'lesson', 'gotcha', 'preference', 'fact'] as const
export type MemoryKind = (typeof MEMORY_KINDS)[number]

export const MEMORY_STATUSES = ['proposed', 'active', 'stale', 'archived', 'superseded'] as const
export type MemoryStatus = (typeof MEMORY_STATUSES)[number]

export interface MemoryRef {
  type: string
  id: string
}

export interface Memory {
  id: string
  project?: string
  kind: MemoryKind
  title: string
  text: string
  scope?: { route?: string; paths?: string[]; tags?: string[] }
  refs?: MemoryRef[]
  confidence?: number
  evidence?: number
  status: MemoryStatus
  supersedes?: string | null
  createdAt?: string
  updatedAt?: string
  lastUsedAt?: string | null
  uses?: number
}

/** `PATCH /api/memory/:id`. */
export type MemoryPatch = Partial<Pick<Memory, 'title' | 'text' | 'kind' | 'scope'>>

/** One result of `GET /api/rag/search` (`aidp rag search --format json`). */
export interface RagHit {
  id: string
  source: string
  path: string
  /** `[start, end]`, or a string like `12-30`. */
  lines?: [number, number] | string
  score: number
  text: string
}

export interface ReindexResult {
  indexed?: number
  updated?: number
  removed?: number
  durationMs?: number
}
