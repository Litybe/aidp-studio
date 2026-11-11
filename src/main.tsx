/*
 * aidp-studio: the front displays, the daemon decides.
 *
 * Performance rules (the front runs beside the Unity editor and games: RAM, CPU and GPU at the
 * strict minimum). Every lot (F1, F2) follows them; README.md « Performance » is the reference.
 *
 * 1. Rendering / GPU: no infinite animation; no backdrop-filter, filter, blur, animated shadow or
 *    gradient, will-change, canvas or WebGL. Gauges are static divs or SVG. Short transitions on
 *    interaction only; prefers-reduced-motion honoured. System font, no webfont, no heavy image.
 * 2. Idle CPU ≈ 0: no polling, data refreshes through SSE only. SSE invalidations are batched
 *    (~300 ms window, deduplicated by key). One global countdown timer, 1 Hz at most, stopped
 *    while the tab is hidden; a hidden tab renders nothing and replays its invalidations on return.
 *    TanStack Query: long staleTime, refetchOnWindowFocus false, no refetchInterval, bounded retry.
 * 3. RAM: gcTime 30 min (tab switches render from the cache; SSE keeps it fresh); bounded rings for every stream (events, journal, session stream);
 *    long lists virtualised (@tanstack/react-virtual) when F1 has them; no global store duplicating
 *    the Query cache; no Devtools in the production build.
 * 4. Bundle: one chunk per route (lazy); no heavy dependency (no chart lib, moment, lodash: use
 *    Intl); Tailwind purged; modern build target; no production sourcemap. Initial JS ≤ 150 KB gzip.
 * 5. React: list and card components memoised, narrow selectors (Query `select`), no context
 *    whose value changes on SSE events (the realtime context holds constant services).
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from './api/queries'
import './index.css'
import { RealtimeContext } from './realtime/context'
import { createRealtime } from './realtime/runtime'
import { createAppRouter } from './router'

const queryClient = createQueryClient()
const realtime = createRealtime(queryClient)
const router = createAppRouter()
realtime.stream.start()

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={realtime}>
        <RouterProvider router={router} />
      </RealtimeContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
