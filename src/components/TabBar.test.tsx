import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { RealtimeContext } from '../realtime/context'
import { createAppRouter } from '../router'
import { Ticker } from '../lib/ticker'
import { EventStream } from '../realtime/events'
import { InvalidationBatcher } from '../realtime/invalidation'
import { FakeVisibility } from '../test/fakes'
import { mockFetch } from '../test/render'

function simulateWidth(mobile: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

async function renderApp() {
  mockFetch({})
  const visibility = new FakeVisibility()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const realtime = {
    ticker: new Ticker(visibility),
    batcher: new InvalidationBatcher(() => {}, visibility),
    stream: new EventStream({ probe: async () => ({ startedAt: '' }), onEvent: () => {}, onResync: () => {}, visibility }),
  }
  const router = createAppRouter()
  router.update({ history: createMemoryHistory({ initialEntries: ['/budget'] }) })
  render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={realtime}>
        <RouterProvider router={router} />
      </RealtimeContext.Provider>
    </QueryClientProvider>,
  )
  await screen.findByRole('navigation', { name: 'Navigation' })
}

describe('navigation by width', () => {
  it('shows the bottom tab bar on a phone', async () => {
    simulateWidth(true)
    await renderApp()
    const nav = screen.getByRole('navigation', { name: 'Navigation' })
    for (const name of ['Accueil', 'Board', 'Inbox', 'Unity', 'Plus…']) {
      expect(nav).toHaveTextContent(name)
    }
    expect(nav).not.toHaveTextContent('Réglages')
    expect(nav).not.toHaveTextContent('Budget')
  })

  it('keeps the side navigation on a desktop', async () => {
    simulateWidth(false)
    await renderApp()
    const nav = screen.getByRole('navigation', { name: 'Navigation' })
    expect(nav).toHaveTextContent('Accueil')
    expect(nav).toHaveTextContent('Budget')
    expect(nav).toHaveTextContent('Réglages')
    expect(nav).not.toHaveTextContent('Plus…')
    expect(screen.getByRole('button', { name: 'Replier la navigation' })).toBeInTheDocument()
  })
})
