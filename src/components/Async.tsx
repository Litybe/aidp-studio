import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { isMissing, isUnsupported } from '../api/send'
import { ComingSoon } from './ComingSoon'

interface AsyncProps<T> {
  query: UseQueryResult<T, unknown>
  /** Names the feature in the « bientôt disponible » line. */
  what: string
  /** Also treat `400` as missing (a `groupBy` value the daemon does not know yet). */
  soft400?: boolean
  children: (data: T) => ReactNode
}

/** Loading, error and « not served yet » states of one query; the page keeps rendering around it. */
export function Async<T>({ query, what, soft400 = false, children }: AsyncProps<T>) {
  if (query.isError) {
    if (soft400 ? isUnsupported(query.error) : isMissing(query.error)) return <ComingSoon what={what} />
    return (
      <p className="text-xs text-rose-400" role="alert">
        {what} : {query.error instanceof Error ? query.error.message : 'erreur'}
      </p>
    )
  }
  if (query.data === undefined) return <p className="text-xs text-ink-faint">{what} : chargement…</p>
  return <>{children(query.data)}</>
}
