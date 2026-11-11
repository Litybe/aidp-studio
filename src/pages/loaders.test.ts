import { QueryClient } from '@tanstack/react-query'
import { mockApi } from '../test/harness'
import { prefetchPage } from './loaders'

describe('prefetchPage', () => {
  it('starts the main queries of the board once, skipping fresh data', async () => {
    const calls = mockApi({ 'GET /tickets': { body: [] }, 'GET /queue': { body: [] } })
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } })
    prefetchPage('/board', client)
    await client.isFetching()
    await vi.waitFor(() => expect(client.getQueryState(['tickets', 'list'])?.status).toBe('success'))
    prefetchPage('/board', client)
    await vi.waitFor(() => expect(client.getQueryState(['queue', 'list'])?.status).toBe('success'))
    expect(calls.filter((call) => call.path === '/tickets')).toHaveLength(1)
    expect(calls.filter((call) => call.path === '/queue')).toHaveLength(1)
  })

  it('ignores a page without loader', () => {
    expect(() => prefetchPage('/nowhere', new QueryClient())).not.toThrow()
  })
})
