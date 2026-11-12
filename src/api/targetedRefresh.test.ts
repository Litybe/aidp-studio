import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { f1Keys } from './f1queries'
import { refreshAfterAction, refreshTicket, ticketOfPath } from './targetedRefresh'
import type { Ticket } from './types'

const apiGet = vi.hoisted(() => vi.fn())
vi.mock('./client', async (original) => ({ ...(await original<typeof import('./client')>()), apiGet }))

const ticket = (key: string, status: string): Ticket => ({ key, summary: key, status })

function seeded(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } } })
  client.setQueryData(f1Keys.tickets, [ticket('GH-1', 'in-progress'), ticket('GH-2', 'in-progress')])
  client.setQueryData(f1Keys.costs, { 'GH-1': {}, 'GH-2': {} })
  client.setQueryData(f1Keys.pr('GH-1'), { number: 1 })
  client.setQueryData(f1Keys.pr('GH-2'), { number: 2 })
  return client
}

describe('ticketOfPath', () => {
  it('reads the ticket of a ticket or flow action', () => {
    expect(ticketOfPath('/tickets/GH-2/cancel')).toBe('GH-2')
    expect(ticketOfPath('/flows/GH-7/steps/review/retry')).toBe('GH-7')
    expect(ticketOfPath('/dispatcher/pause')).toBeNull()
  })
})

describe('refreshAfterAction', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it('patches only the acted-on ticket and leaves the other queries fresh', async () => {
    apiGet.mockResolvedValue({ ticket: ticket('GH-2', 'cancelled'), body: '' })
    const client = seeded()
    refreshAfterAction('/tickets/GH-2/cancel', client)
    await vi.waitFor(() => expect(client.getQueryData<Ticket[]>(f1Keys.tickets)?.[1]?.status).toBe('cancelled'))
    expect(apiGet).toHaveBeenCalledWith('/tickets/GH-2')
    expect(client.getQueryData<Ticket[]>(f1Keys.tickets)?.[0]?.status).toBe('in-progress')
    expect(client.getQueryState(f1Keys.pr('GH-2'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(f1Keys.pr('GH-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(f1Keys.costs)?.isInvalidated).toBe(false)
    expect(client.getQueryState(f1Keys.tickets)?.isInvalidated).toBe(false)
  })

  it('falls back to refetching the list when the ticket cannot be read', async () => {
    apiGet.mockImplementation(async () => {
      throw new Error('down')
    })
    const client = seeded()
    await refreshTicket(client, 'GH-1')
    expect(client.getQueryState(f1Keys.tickets)?.isInvalidated).toBe(true)
    expect(client.getQueryState(f1Keys.costs)?.isInvalidated).toBe(false)
  })
})
