import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { Ticker } from '../lib/ticker'
import { RealtimeContext } from '../realtime/context'
import { EventStream } from '../realtime/events'
import { InvalidationBatcher } from '../realtime/invalidation'
import type { Realtime } from '../realtime/runtime'
import { FakeVisibility } from './fakes'

export interface MockReply {
  status?: number
  body?: unknown
  text?: string
}

export interface RecordedCall {
  method: string
  path: string
  body: unknown
}

type Handler = MockReply | ((call: RecordedCall) => MockReply)

/**
 * Replaces `fetch`: routes are keyed `"GET /tickets"` (path after `/api`, query included).
 * An unknown route answers a JSON 404, like a daemon that lacks the route.
 */
export function mockApi(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input).replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    const call: RecordedCall = {
      method,
      path: url,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }
    calls.push(call)
    const handler = routes[`${method} ${url}`]
    if (!handler) {
      return Promise.resolve(
        new Response('{"error":"not found","code":"not_found"}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    const reply = typeof handler === 'function' ? handler(call) : handler
    const status = reply.status ?? 200
    if (reply.text !== undefined) {
      return Promise.resolve(new Response(reply.text, { status, headers: { 'content-type': 'text/markdown' } }))
    }
    const json = reply.body === undefined ? '' : JSON.stringify(reply.body)
    return Promise.resolve(new Response(json, { status, headers: { 'content-type': 'application/json' } }))
  })
  return calls
}

function fakeRealtime(visibility: FakeVisibility, queryClient: QueryClient): Realtime {
  return {
    ticker: new Ticker(visibility),
    batcher: new InvalidationBatcher(
      (keys) => keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey })),
      visibility,
    ),
    stream: new EventStream({ probe: async () => ({ startedAt: '' }), onEvent: () => {}, onResync: () => {}, visibility }),
  }
}

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, gcTime: Infinity } },
  })
}

interface RenderOptions {
  /** Route pattern of the page under test (default `/`). */
  pattern?: string
  /** Initial URL (default `/`). */
  url?: string
  queryClient?: QueryClient
}

/** Renders `Page` at `pattern` in a memory router, with a QueryClient and fake realtime services. */
export function renderPage(Page: ComponentType, options: RenderOptions = {}) {
  const queryClient = options.queryClient ?? testQueryClient()
  const pattern = options.pattern ?? '/'
  const root = createRootRoute({ component: Outlet })
  const stub = (path: string) => createRoute({ getParentRoute: () => root, path, component: () => <p>{path}</p> })
  const children = [createRoute({ getParentRoute: () => root, path: pattern, component: () => <Page /> })]
  for (const path of ['/issue/$key', '/board', '/inbox']) if (path !== pattern) children.push(stub(path))
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [options.url ?? '/'] }),
  })
  const visibility = new FakeVisibility()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={fakeRealtime(visibility, queryClient)}>
        <RouterProvider router={router} />
      </RealtimeContext.Provider>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}
