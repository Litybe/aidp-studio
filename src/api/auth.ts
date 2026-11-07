import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'aidp-studio.token'

/**
 * The UI token (`AIDP_UI_TOKEN`) for off-loopback access. Memory first; `localStorage` only when the
 * user ticks « se souvenir ». Never put in a URL, never logged. On loopback no token is needed.
 */
let token: string | null = readStored()
let loginRequired = false
const listeners = new Set<() => void>()
const tokenListeners = new Set<() => void>()

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage disabled: the token lasts for this page only.
  }
}

function emit(set: Set<() => void>): void {
  for (const listener of set) listener()
}

export function getToken(): string | null {
  return token
}

/** `Authorization` header for every `/api` call, empty when no token is known. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function setToken(value: string, remember: boolean): void {
  token = value.trim() === '' ? null : value.trim()
  writeStored(remember ? token : null)
  loginRequired = false
  emit(listeners)
  emit(tokenListeners)
}

export function clearToken(): void {
  token = null
  writeStored(null)
  emit(listeners)
  emit(tokenListeners)
}

/** A route answered `401`: the app shows the « Connexion » page. */
export function markUnauthorized(): void {
  if (loginRequired) return
  loginRequired = true
  emit(listeners)
}

export function isLoginRequired(): boolean {
  return loginRequired
}

/** Called when the token changes (login, logout): the stream and the cache restart. */
export function onTokenChange(listener: () => void): () => void {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLoginRequired(): boolean {
  return useSyncExternalStore(subscribe, isLoginRequired)
}

export function useHasToken(): boolean {
  return useSyncExternalStore(subscribe, () => token !== null)
}

/** `fetch` with the token header; a `401` flips the app to the login page. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...authHeaders(), ...((init.headers as Record<string, string> | undefined) ?? {}) }
  const response = await fetch(input, { ...init, headers })
  if (response.status === 401) markUnauthorized()
  return response
}

/** Single-use `?es=` token for the `EventSource` (`POST /api/events/token`); null when the route is absent. */
export async function fetchEventToken(): Promise<string | null> {
  const response = await authFetch('/api/events/token', { method: 'POST', headers: { Accept: 'application/json' } })
  if (response.status === 401) throw new Error('unauthorized')
  if (!response.ok) return null
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null
  return typeof body?.token === 'string' ? body.token : null
}
