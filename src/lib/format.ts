/** "3 min", "1 h 05", "2 j 4 h": coarse on purpose, so a label changes once a minute. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(hours / 24)} j ${hours % 24} h`
}

/** Duration between two ISO instants; `end` defaults to `now`. Empty when `start` is unknown. */
export function elapsedLabel(start: string | null | undefined, end: string | null | undefined, now: number): string {
  if (!start) return ''
  const from = Date.parse(start)
  const to = end ? Date.parse(end) : now
  if (Number.isNaN(from) || Number.isNaN(to)) return ''
  return formatDuration(to - from)
}

const COMPACT = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatTokens(tokens: number): string {
  return `${COMPACT.format(tokens)} tok`
}

const USD = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function formatUsd(value: number): string {
  return USD.format(value)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isNaN(ms) ? '—' : DATE_TIME.format(ms)
}

/** `8,4 s`, `2 min 5 s`. */
export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes} min ${seconds} s`
}


/** A list answer that may come bare or wrapped as `{ items: [...] }`. */
export function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'object' && value !== null) {
    const items = (value as { items?: unknown }).items
    if (Array.isArray(items)) return items as T[]
  }
  return []
}
