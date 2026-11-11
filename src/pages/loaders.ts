import type { QueryClient } from '@tanstack/react-query'
import { inboxQuery, queueQuery, ticketsQuery } from '../api/f1queries'
import { dispatcherBudgetQuery } from '../api/queries'

/** Lazy chunk of each page; the router and the prefetch share these loaders (one import each). */
export const PAGE_LOADERS = {
  '/': () => import('./home/HomePage'),
  '/board': () => import('./board/BoardPage'),
  '/issue/$key': () => import('./issue/IssuePage'),
  '/inbox': () => import('./inbox/InboxPage'),
  '/unity': () => import('./unity/UnityPage'),
  '/budget': () => import('./budget/BudgetPage'),
  '/memory': () => import('./memory/MemoryPage'),
  '/art': () => import('./art/ArtPage'),
  '/settings': () => import('./settings/SettingsPage'),
} as const

/** Main (never secondary) queries of a page, warmed on hover and idle. */
const MAIN_QUERIES: Record<string, (client: QueryClient) => void> = {
  '/': (client) => {
    void client.prefetchQuery(ticketsQuery)
    void client.prefetchQuery(inboxQuery)
  },
  '/board': (client) => {
    void client.prefetchQuery(ticketsQuery)
    void client.prefetchQuery(queueQuery)
  },
  '/inbox': (client) => {
    void client.prefetchQuery(inboxQuery)
  },
  '/budget': (client) => {
    void client.prefetchQuery(dispatcherBudgetQuery)
  },
}

/** Pages whose chunk is fetched once the first page has rendered. */
export const IDLE_PAGES = ['/board', '/', '/inbox', '/budget'] as const

/** Downloads the chunk of `to` and, when it has one, starts its main queries. Errors are ignored. */
export function prefetchPage(to: string, client?: QueryClient): void {
  const load = (PAGE_LOADERS as Record<string, (() => Promise<unknown>) | undefined>)[to]
  if (load) void load().catch(() => {})
  // prefetchQuery skips fresh data, so a warm cache costs nothing.
  if (client) MAIN_QUERIES[to]?.(client)
}

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }

/** After the first render, once the browser is idle: the chunks of the main pages. */
export function prefetchMainPagesWhenIdle(): void {
  const run = () => IDLE_PAGES.forEach((to) => prefetchPage(to))
  const idle = (window as IdleWindow).requestIdleCallback
  if (idle) idle.call(window, run, { timeout: 5000 })
  else setTimeout(run, 1500)
}
