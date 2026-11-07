import { API_BASE, ApiError } from './client'
import type { SaveFlags } from './types/budget'

const JSON_TYPE = 'application/json'

/** One validation problem the daemon reports for a field (`path` like `rules.0.match.label`). */
export interface FieldError {
  path: string
  message: string
}

/** A `400` whose body lists the problems field by field; `general` holds what names no field. */
export class ApiValidationError extends ApiError {
  readonly fields: FieldError[]
  readonly general: string[]

  constructor(message: string, fields: FieldError[], general: string[]) {
    super('http', message, 400, 'validation')
    this.name = 'ApiValidationError'
    this.fields = fields
    this.general = general
  }

  /** Messages by normalised path. */
  byPath(): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const { path, message } of this.fields) {
      const list = map.get(path) ?? []
      list.push(message)
      map.set(path, list)
    }
    return map
  }
}

/** `rules[0].match` and `rules.0.match` both become `rules.0.match`; a leading `/` or `$.` goes. */
export function normalizePath(path: string): string {
  return path
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\//g, '.')
    .replace(/^\./, '')
}

function pushEntry(entry: unknown, fields: FieldError[], general: string[]): void {
  if (typeof entry === 'string') {
    general.push(entry)
    return
  }
  if (typeof entry !== 'object' || entry === null) return
  const record = entry as Record<string, unknown>
  const message = typeof record['message'] === 'string' ? record['message'] : typeof record['error'] === 'string' ? record['error'] : null
  if (message === null) return
  const path = [record['field'], record['path'], record['pointer']].find((value) => typeof value === 'string' && value !== '')
  if (typeof path === 'string') fields.push({ path: normalizePath(path), message })
  else general.push(message)
}

/** Reads `errors` as a list of `{field|path, message}`, a list of strings, or a `{ field: message }` map. */
export function parseValidationBody(body: unknown): { fields: FieldError[]; general: string[]; message: string } {
  const fields: FieldError[] = []
  const general: string[] = []
  let message = 'validation refusée'
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>
    if (typeof record['error'] === 'string') message = record['error']
    const list = record['errors'] ?? record['details']
    if (Array.isArray(list)) {
      for (const entry of list) pushEntry(entry, fields, general)
    } else if (typeof list === 'object' && list !== null) {
      for (const [path, value] of Object.entries(list)) {
        const messages: unknown[] = Array.isArray(value) ? value : [value]
        for (const text of messages) if (typeof text === 'string') fields.push({ path: normalizePath(path), message: text })
      }
    }
  }
  return { fields, general, message }
}

export type SendMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** `POST`/`PUT`/`PATCH` a JSON body to `/api<path>`. A `400` with a list becomes an {@link ApiValidationError}. */
export async function apiSend<T>(method: SendMethod, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Accept: JSON_TYPE, ...(body === undefined ? {} : { 'Content-Type': JSON_TYPE }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError('unreachable', 'daemon injoignable')
  }
  const isJson = (response.headers.get('content-type') ?? '').includes(JSON_TYPE)
  if (!response.ok) {
    const parsed: unknown = isJson ? await response.json().catch(() => null) : null
    if (response.status === 400) {
      const { fields, general, message } = parseValidationBody(parsed)
      throw new ApiValidationError(message, fields, general)
    }
    const text = typeof parsed === 'object' && parsed !== null ? (parsed as { error?: unknown }).error : null
    throw new ApiError('http', typeof text === 'string' ? text : `HTTP ${response.status}`, response.status)
  }
  if (!isJson) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('parse', 'réponse illisible', response.status)
  }
}

/** The daemon does not have this route yet (`404`): the page shows « bientôt disponible », never an error. */
export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'http' && error.status === 404
}

/** Like {@link isMissing}, plus `400` (an unknown `groupBy` value the daemon does not know yet). */
export function isUnsupported(error: unknown): boolean {
  return isMissing(error) || (error instanceof ApiError && error.kind === 'http' && error.status === 400)
}

/** `retry` of an optional feature: a missing route is final, anything else follows the default bounds. */
export function retryOptional(failures: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.kind === 'unreachable' || isUnsupported(error))) return false
  return failures < 2
}

/** Daemon errors for one field, whether the path reads `night_mode` or `budget.night_mode`. */
export function fieldErrors(error: unknown, field: string): string[] {
  if (!(error instanceof ApiValidationError)) return []
  const out: string[] = []
  for (const [path, messages] of error.byPath()) if (path === field || path.endsWith(`.${field}`)) out.push(...messages)
  return out
}

/** A `PUT /api/settings/*` reply without its `reloadRequired` and `changed` flags: the shape of the `GET`. */
export function withoutSaveFlags<T extends object>(reply: T): T {
  const settings: Partial<T & SaveFlags> = { ...reply }
  delete settings.reloadRequired
  delete settings.changed
  return settings as T
}
