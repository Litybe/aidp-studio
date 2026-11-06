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

/** `1,2 Mo`, `340 Ko`, `12 o`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
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
