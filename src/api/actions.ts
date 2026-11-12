import { authFetch } from './auth'
import { useMutation } from '@tanstack/react-query'
import { API_BASE, ApiError } from './client'
import type { ApiErrorBody } from './types'

const JSON_TYPE = 'application/json'

/** Called with the path of every successful POST; `main.tsx` plugs the targeted cache refresh in. */
let actionListener: ((path: string) => void) | null = null

export function setActionListener(listener: ((path: string) => void) | null): void {
  actionListener = listener
}

/** A route the daemon does not have yet (C11): the UI shows "bientôt disponible", never an error. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'http' && (error.status === 404 || error.status === 405)
}

async function toError(response: Response): Promise<ApiError> {
  const isJson = (response.headers.get('content-type') ?? '').includes(JSON_TYPE)
  if (!isJson) {
    if (response.status >= 500) return new ApiError('unreachable', 'daemon injoignable', response.status)
    return new ApiError('http', `HTTP ${response.status}`, response.status)
  }
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null
  return new ApiError('http', body?.error ?? `HTTP ${response.status}`, response.status, body?.code ?? null)
}

/** `POST /api<path>` with an optional JSON body. The answer may be empty. */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await authFetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Accept: JSON_TYPE, ...(body === undefined ? {} : { 'Content-Type': JSON_TYPE }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError('unreachable', 'daemon injoignable')
  }
  if (!response.ok) throw await toError(response)
  actionListener?.(path)
  const text = await response.text()
  if (text.length === 0) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

/** `GET /api<path>` as text (Markdown artefacts). */
export async function apiGetText(path: string, signal?: AbortSignal): Promise<string> {
  let response: Response
  try {
    response = await authFetch(`${API_BASE}${path}`, signal ? { signal } : {})
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('unreachable', 'daemon injoignable')
  }
  if (!response.ok) throw await toError(response)
  return response.text()
}

/** URL of a file of a run, for `<img src>`. Each segment is encoded, the slashes stay. */
export function runFileUrl(runId: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${API_BASE}/runs/${encodeURIComponent(runId)}/files/${encoded}`
}

export interface ActionFeedback {
  pending: boolean
  /** Message of a failed action. */
  error: string | null
  /** The route is not in the daemon yet. */
  soon: boolean
  done: boolean
}

/** One daemon action: `run()` posts, `feedback` says what happened. No retry, no cache. */
export function useApiAction<V = void>(send: (variables: V) => Promise<unknown>) {
  const mutation = useMutation({ mutationFn: send, retry: false })
  const feedback: ActionFeedback = {
    pending: mutation.isPending,
    error: mutation.error && !isNotFound(mutation.error) ? mutation.error.message : null,
    soon: isNotFound(mutation.error),
    done: mutation.isSuccess,
  }
  return { run: mutation.mutate, feedback }
}

const seg = encodeURIComponent

/** The POST routes of the pages, in one place. */
export const routes = {
  ticketStart: (key: string) => `/tickets/${seg(key)}/start`,
  ticketCancel: (key: string) => `/tickets/${seg(key)}/cancel`,
  ticketStatus: (key: string) => `/tickets/${seg(key)}/status`,
  ticketForce: (key: string) => `/tickets/${seg(key)}/force`,
  ticketsSync: '/tickets/sync?source=github',
  flowPause: (key: string) => `/flows/${seg(key)}/pause`,
  flowResume: (key: string) => `/flows/${seg(key)}/resume`,
  flowAbort: (key: string) => `/flows/${seg(key)}/abort`,
  flowManual: (key: string) => `/flows/${seg(key)}/manual`,
  step: (key: string, stepId: string, verb: 'retry' | 'skip' | 'approve' | 'reject') =>
    `/flows/${seg(key)}/steps/${seg(stepId)}/${verb}`,
  dispatcher: (verb: 'pause' | 'resume') => `/dispatcher/${verb}`,
  dispatcherTick: '/dispatcher/tick',
  prUpdateBranch: '/prs/update-branch',
  queuePromote: (id: string) => `/queue/${seg(id)}/promote`,
  sessionReply: (id: string) => `/sessions/${seg(id)}/reply`,
}
