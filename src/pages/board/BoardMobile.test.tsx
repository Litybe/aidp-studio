import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Ticket } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import BoardPage from './BoardPage'
import { VIRTUALIZE_ABOVE } from './Column'

function simulateMobile() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

afterEach(() => vi.unstubAllGlobals())

const merge: Ticket = {
  key: 'GH-1',
  summary: 'Dash en l’air',
  status: 'in-review',
  labels: ['aidp:awaiting-merge'],
  route: 'code',
  githubNumber: 1,
  milestone: { title: 'VS', dueOn: null },
  flowSummary: {
    flowKey: 'GH-1',
    status: 'waiting_human',
    phase: 'merge',
    stepId: 'merge_gate',
    iteration: 1,
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
}
const blocked: Ticket = {
  key: 'GH-2',
  summary: 'Sprite du héros',
  status: 'blocked: ldtk cassé',
  labels: [],
  route: 'art',
  githubNumber: 2,
}
const ready: Ticket = { key: 'GH-3', summary: 'Salle du boss', status: 'todo', route: 'map', githubNumber: 3 }
const readyB: Ticket = { key: 'GH-4', summary: 'Doc du HUD', status: 'todo', route: 'doc', githubNumber: 4 }

function api(tickets: Ticket[]) {
  return mockApi({ 'GET /tickets': { body: tickets }, 'GET /queue': { body: [] } })
}

describe('BoardMobile', () => {
  beforeEach(simulateMobile)

  it('opens on À merger and counts the states, hiding the empty ones', async () => {
    api([merge, blocked, ready, readyB])
    renderPage(BoardPage)
    const merging = await screen.findByRole('button', { name: 'À merger 1' })
    expect(merging).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bloquées 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prêtes 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Revue/ })).not.toBeInTheDocument()
    expect(screen.getByText('Dash en l’air')).toBeInTheDocument()
    expect(screen.queryByText('Sprite du héros')).not.toBeInTheDocument()
  })

  it('falls back to Bloquées, then lets the user pick another state', async () => {
    api([blocked, ready])
    renderPage(BoardPage)
    expect(await screen.findByRole('button', { name: 'Bloquées 1' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Prêtes 1' }))
    expect(await screen.findByText('Salle du boss')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prêtes 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reads the state from the URL', async () => {
    api([merge, ready])
    renderPage(BoardPage, { url: '/?s=ready' })
    expect(await screen.findByText('Salle du boss')).toBeInTheDocument()
    expect(screen.queryByText('Dash en l’air')).not.toBeInTheDocument()
  })

  it('filters by route from the filters sheet, with no native route select', async () => {
    api([ready, readyB])
    renderPage(BoardPage)
    await screen.findByText('Salle du boss')
    expect(screen.queryByLabelText('Filtrer par route')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Filtres' })).getByRole('button', { name: 'Doc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voir les tickets' }))
    expect(screen.queryByText('Salle du boss')).not.toBeInTheDocument()
    expect(screen.getByText('Doc du HUD')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prêtes 1' })).toBeInTheDocument()
  })

  it('filters by text in the sheet, counts active filters and clears them', async () => {
    api([ready, readyB])
    renderPage(BoardPage)
    await screen.findByText('Salle du boss')
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    const sheet = screen.getByRole('dialog', { name: 'Filtres' })
    fireEvent.change(within(sheet).getByLabelText('Recherche'), { target: { value: '#4' } })
    expect(screen.queryByText('Salle du boss')).not.toBeInTheDocument()
    expect(screen.getByText('Doc du HUD')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Voir les tickets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Filtres 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }))
    expect(screen.getByText('Salle du boss')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les tickets' }))
    expect(screen.getByRole('button', { name: 'Filtres' })).toBeInTheDocument()
  })

  it('shows a compact card: number, title, route and step only, linked to the issue', async () => {
    api([merge])
    renderPage(BoardPage)
    const card = await screen.findByTestId('card-GH-1')
    expect(within(card).getByText('#1')).toBeInTheDocument()
    expect(within(card).getByText('Code')).toBeInTheDocument()
    expect(within(card).getByText('merge_gate')).toBeInTheDocument()
    expect(within(card).queryByText('VS')).not.toBeInTheDocument()
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/issue/GH-1')
    expect(within(card).queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
  })

  it('merges after a second tap and opens the other actions in a sheet', async () => {
    const calls = mockApi({
      'GET /tickets': { body: [merge] },
      'GET /queue': { body: [] },
      'POST /flows/GH-1/steps/merge_gate/approve': { body: { ok: true } },
    })
    renderPage(BoardPage)
    fireEvent.click(await screen.findByRole('button', { name: 'Merger' }))
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ?' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/flows/GH-1/steps/merge_gate/approve')).toBe(true))
    fireEvent.click(screen.getByLabelText('Actions #1'))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
  })

  it('puts « Remettre prête » and the reason on a blocked card', async () => {
    const calls = mockApi({
      'GET /tickets': { body: [blocked] },
      'GET /queue': { body: [] },
      'POST /tickets/GH-2/status': { body: { ok: true } },
    })
    renderPage(BoardPage)
    const card = await screen.findByTestId('card-GH-2')
    expect(within(card).getByText('ldtk cassé')).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Remettre prête' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/tickets/GH-2/status')).toBe(true))
  })

  it('groups the global actions in the ⋯ menu', async () => {
    api([ready])
    renderPage(BoardPage)
    await screen.findByText('Salle du boss')
    expect(screen.queryByRole('button', { name: 'Sync GitHub' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Actions du board'))
    const menu = screen.getByRole('dialog', { name: 'Actions du board' })
    expect(within(menu).getByRole('button', { name: 'Sync GitHub' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Pause du dispatcher' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Nouveau run' })).toBeInTheDocument()
  })

  it('virtualizes a long state', async () => {
    const many = Array.from({ length: VIRTUALIZE_ABOVE + 30 }, (_, index): Ticket => ({
      key: `GH-${1000 + index}`,
      summary: `Carte ${index}`,
      status: 'todo',
      githubNumber: 1000 + index,
    }))
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
    api(many)
    renderPage(BoardPage)
    const list = await screen.findByTestId('virtual-list')
    const rendered = await within(list).findAllByRole('article')
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(many.length)
  })
})
