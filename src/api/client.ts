import type { ApiErrorBody } from './types'

/** Every route goes through the same origin: the daemon itself, or the Vite proxy in dev. */
export const API_BASE = '/api'

/**
 * `unreachable`: no answer from the daemon (network error, or a non-JSON 5xx from the dev proxy).
 * `http`: the daemon answered with an error. `parse`: the daemon answered something unreadable.
 */
export type ApiErrorKind = 'unreachable' | 'http' | 'parse'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: string | null

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}

export function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unreachable'
}

const JSON_TYPE = 'application/json'

function isJson(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes(JSON_TYPE)
}

/** `GET /api<path>`, typed. Throws an {@link ApiError}; never retries itself (TanStack Query does, bounded). */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: JSON_TYPE },
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('unreachable', 'daemon injoignable')
  }
  if (!response.ok) {
    if (!isJson(response)) {
      if (response.status >= 500) throw new ApiError('unreachable', 'daemon injoignable', response.status)
      throw new ApiError('http', `HTTP ${response.status}`, response.status)
    }
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError('http', body?.error ?? `HTTP ${response.status}`, response.status, body?.code ?? null)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('parse', 'réponse illisible', response.status)
  }
}
