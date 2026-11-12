import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Ticket } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import BoardPage from './BoardPage'
import { VIRTUALIZE_ABOVE } from './Column'

const ready: Ticket = {
  key: 'GH-12',
  summary: 'Dash en l’air',
  status: 'todo',
  labels: ['aidp:ready'],
  route: 'code',
  milestone: { title: 'Vertical slice', dueOn: null },
  githubNumber: 12,
}
const running: Ticket = {
  key: 'GH-13',
  summary: 'Sprite du héros',
  status: 'in-progress',
  labels: ['aidp:in-progress'],
  route: 'art',
  githubNumber: 13,
  flowSummary: {
    flowKey: 'GH-13',
    status: 'running',
    phase: 'implement',
    stepId: 'art-produce',
    iteration: 1,
    startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
}

describe('BoardPage', () => {
  it('puts bugs on their own red board, apart from the dev board', async () => {
    const bug: Ticket = { key: 'GH-20', summary: 'Crash au dash', status: 'todo', labels: ['bug'], tags: ['aidp/bug'], type: 'Bug', githubNumber: 20 }
    mockApi({ 'GET /tickets': { body: [ready, bug] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    const bugBoard = await screen.findByRole('region', { name: 'Board bugs' })
    expect(within(bugBoard).getByText('#20')).toBeInTheDocument()
    expect(within(bugBoard).queryByText('#12')).not.toBeInTheDocument()
    expect(screen.getAllByText('#12')).toHaveLength(1)
    expect(screen.getByTestId('card-GH-20')).toHaveAttribute('data-bug', 'true')
  })

  it('shows no bug board without a bug', async () => {
    mockApi({ 'GET /tickets': { body: [ready] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    await screen.findByText('Dash en l’air')
    expect(screen.queryByRole('region', { name: 'Board bugs' })).not.toBeInTheDocument()
  })

  it('shows the cards in their column with number, route, milestone, step and cost', async () => {
    mockApi({
      'GET /tickets': { body: [ready, running] },
      'GET /queue': { body: [] },
      'GET /tickets/costs': {
        body: { 'GH-12': { costUsd: 1.5 }, 'GH-13': { costUsd: 0.25, reviewTurns: 2, testTurns: 1 } },
      },
    })
    renderPage(BoardPage)
    const readyColumn = await screen.findByRole('region', { name: 'Prêtes' })
    expect(within(readyColumn).getByText('#12')).toBeInTheDocument()
    expect(within(readyColumn).getByText('Vertical slice')).toBeInTheDocument()
    expect(await within(readyColumn).findByText(/1,50/)).toBeInTheDocument()
    const doing = screen.getByRole('region', { name: 'Réalisation' })
    expect(within(doing).getByText('art-produce')).toBeInTheDocument()
    expect(within(doing).getByLabelText('Route Art')).toBeInTheDocument()
    expect(await within(doing).findByText('revue 2 · test 1')).toBeInTheDocument()
    expect(within(doing).getByText('12 min')).toBeInTheDocument()
  })

  it('asks the costs once for the whole board, never per card', async () => {
    const calls = mockApi({
      'GET /tickets': { body: [ready, running] },
      'GET /queue': { body: [] },
      'GET /tickets/costs': { body: { 'GH-12': { costUsd: 1.5, totals: { totalTokens: 2000 } } } },
    })
    renderPage(BoardPage)
    expect(await screen.findByText(/1,50/)).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/tickets/costs')).toHaveLength(1)
    expect(calls.filter((c) => c.path.endsWith('/cost'))).toHaveLength(0)
  })

  it('works, with no per-card request, when the costs route answers 404', async () => {
    const calls = mockApi({ 'GET /tickets': { body: [ready, running] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    await screen.findByText('Dash en l’air')
    await waitFor(() => expect(calls.filter((c) => c.path === '/tickets/costs')).toHaveLength(1))
    expect(calls.filter((c) => c.path.endsWith('/cost'))).toHaveLength(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Sprite du héros')).toBeInTheDocument()
  })

  it('filters by route', async () => {
    mockApi({ 'GET /tickets': { body: [ready, running] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    await screen.findByText('Dash en l’air')
    fireEvent.change(screen.getByLabelText('Filtrer par route'), { target: { value: 'art' } })
    expect(screen.queryByText('Dash en l’air')).not.toBeInTheDocument()
    expect(screen.getByText('Sprite du héros')).toBeInTheDocument()
  })

  it('launches a ready ticket and asks confirmation before cancelling', async () => {
    const calls = mockApi({
      'GET /tickets': { body: [ready] },
      'GET /queue': { body: [] },
      'POST /tickets/GH-12/start': { body: { ok: true } },
      'POST /tickets/GH-12/cancel': { body: { ok: true } },
    })
    renderPage(BoardPage)
    fireEvent.click(await screen.findByLabelText('Actions #12'))
    fireEvent.click(screen.getByRole('button', { name: 'Lancer maintenant' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/tickets/GH-12/start')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(calls.some((c) => c.path === '/tickets/GH-12/cancel')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Non' }))
    expect(calls.some((c) => c.path === '/tickets/GH-12/cancel')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/tickets/GH-12/cancel')).toBe(true))
  })

  it('shows a quiet "bientôt disponible" when Sync GitHub is not in the daemon', async () => {
    mockApi({ 'GET /tickets': { body: [] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    fireEvent.click(await screen.findByRole('button', { name: 'Sync GitHub' }))
    expect(await screen.findByTestId('soon')).toHaveTextContent('bientôt disponible')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('virtualizes a column past the threshold', async () => {
    const many = Array.from({ length: VIRTUALIZE_ABOVE + 30 }, (_, index): Ticket => ({
      key: `GH-${1000 + index}`,
      summary: `Carte ${index}`,
      status: 'todo',
      githubNumber: 1000 + index,
    }))
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(280)
    mockApi({ 'GET /tickets': { body: many }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    const list = await screen.findByTestId('virtual-list')
    const rendered = await within(list).findAllByRole('article')
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(many.length)
  })
})
