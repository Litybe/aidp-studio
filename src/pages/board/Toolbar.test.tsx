import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderPage } from '../../test/harness'
import { Toolbar } from './Toolbar'

const baseState = {
  mode: 'normal',
  paused: false,
  waitUntil: null,
  lastTickAt: '2026-11-11T10:00:00Z',
  lastReason: 'rien à lancer',
  slots: { used: 1, max: 3, testUsed: 0, testMax: 1 },
  running: [],
}
const budget = { verdict: { verdict: 'go' }, live: null, reserves: { fiveHour: 0, sevenDay: 0, learned: false }, unreflected: 0, stats: {} }

describe('Toolbar dispatcher', () => {
  it('pauses with { paused: true } and shows the state', async () => {
    const calls = mockApi({
      'GET /dispatcher': { body: baseState },
      'GET /dispatcher/budget': { body: budget },
      'POST /dispatcher/pause': { body: { paused: true } },
    })
    renderPage(Toolbar)
    expect(await screen.findByText(/Dispatcher : actif · 1\/3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause du dispatcher' }))
    await waitFor(() => expect(calls.find((c) => c.path === '/dispatcher/pause')?.body).toEqual({ paused: true }))
  })

  it('offers « Reprendre » when manually paused', async () => {
    const calls = mockApi({
      'GET /dispatcher': { body: { ...baseState, mode: 'paused', paused: true } },
      'GET /dispatcher/budget': { body: budget },
      'POST /dispatcher/resume': { body: { paused: false } },
    })
    renderPage(Toolbar)
    expect(await screen.findByText(/en pause \(manuel\)/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre le dispatcher' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/dispatcher/resume')).toBe(true))
  })
})
