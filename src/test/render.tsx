import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Ticker } from '../lib/ticker'
import { RealtimeContext } from '../realtime/context'
import { EventStream } from '../realtime/events'
import { InvalidationBatcher } from '../realtime/invalidation'
import type { Realtime } from '../realtime/runtime'
import { FakeVisibility } from './fakes'

/** Renders a page with a fresh Query client (no retry) and a Realtime built from fakes. */
export function renderPage(ui: ReactElement) {
  const visibility = new FakeVisibility()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const realtime: Realtime = {
    ticker: new Ticker(visibility),
    batcher: new InvalidationBatcher((keys) => keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey })), visibility),
    stream: new EventStream({ probe: async () => ({ startedAt: '' }), onEvent: () => {}, onResync: () => {}, visibility }),
  }
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={realtime}>{ui}</RealtimeContext.Provider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

export interface MockReply {
  status?: number
  body?: unknown
}

export interface FetchCall {
  method: string
  path: string
  body: unknown
}

/**
 * Replaces `fetch`: routes are `"GET /unity/status"` (no `/api`, no query unless the key has one;
 * a key without query matches any query). Unknown routes answer 404. Returns the calls made.
 */
export function mockFetch(routes: Record<string, MockReply | ((call: FetchCall) => MockReply)>): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^\/api/, '')
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
      const call = { method, path: url, body }
      calls.push(call)
      const bare = url.split('?')[0] ?? url
      const entry = routes[`${method} ${url}`] ?? routes[`${method} ${bare}`]
      const reply = typeof entry === 'function' ? entry(call) : entry
      const status = reply?.status ?? (entry ? 200 : 404)
      return new Response(JSON.stringify(reply?.body ?? (entry ? {} : { error: 'not found' })), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}
