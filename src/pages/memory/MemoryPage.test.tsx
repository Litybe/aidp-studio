import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Memory } from '../../api/types/memory'
import { MemoryBadge } from '../../components/MemoryBadge'
import { mockFetch, renderPage } from '../../test/render'
import MemoryPage from './MemoryPage'
import { citation } from './queries'

const memory = (index: number, status: Memory['status'] = 'active'): Memory => ({
  id: `M-${index}`,
  kind: 'lesson',
  title: `Mémoire ${index}`,
  text: `Texte ${index}`,
  status,
  confidence: 0.8,
  evidence: 1,
  uses: 3,
  scope: { route: 'code', tags: ['physics'] },
  refs: [{ type: 'issue', id: 'GH-214' }],
})

// jsdom has no layout: give the scroll container a size so the virtualizer renders a window.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 440 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 500 })
})

afterEach(() => vi.unstubAllGlobals())

describe('citation', () => {
  it('formats path:Lstart-end', () => {
    expect(citation({ path: 'Docs/a.md', lines: [12, 30] })).toBe('Docs/a.md:L12-30')
    expect(citation({ path: 'Docs/a.md', lines: '5-9' })).toBe('Docs/a.md:L5-9')
    expect(citation({ path: 'Docs/a.md' })).toBe('Docs/a.md')
  })
})

describe('Mémoire', () => {
  it('virtualises the list: far fewer rows in the DOM than memories', async () => {
    mockFetch({ 'GET /memory': { body: Array.from({ length: 500 }, (_, index) => memory(index)) } })
    renderPage(<MemoryPage />)
    await screen.findByTestId('memory-list')
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(40)
  })

  it('approves a proposal, merges and edits through the daemon', async () => {
    const calls = mockFetch({
      'GET /memory': { body: [memory(1, 'proposed'), memory(2)] },
      'POST /memory/M-1/approve': { body: {} },
      'POST /memory/M-1/merge': { body: {} },
      'PATCH /memory/M-1': { body: {} },
    })
    renderPage(<MemoryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Mémoire 1/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Approuver' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/memory/M-1/approve')).toBe(true))
    await userEvent.type(screen.getByLabelText('Fusionner dans'), 'M-2')
    await userEvent.click(screen.getByRole('button', { name: 'Fusionner' }))
    await waitFor(() => expect(calls.find((call) => call.path === '/memory/M-1/merge')?.body).toEqual({ into: 'M-2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Éditer' }))
    const title = screen.getByLabelText('Titre')
    await userEvent.clear(title)
    await userEvent.type(title, 'Nouveau titre')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({ title: 'Nouveau titre', kind: 'lesson' }))
  })

  it('archives, filters by status and sends the filters to the daemon', async () => {
    const calls = mockFetch({ 'GET /memory': { body: [memory(1)] }, 'POST /memory/M-1/archive': { body: {} } })
    renderPage(<MemoryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Mémoire 1/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Archiver' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/memory/M-1/archive')).toBe(true))
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'stale')
    await waitFor(() => expect(calls.some((call) => call.path === '/memory?status=stale')).toBe(true))
  })

  it('searches the corpus and shows the citations, then reindexes', async () => {
    mockFetch({
      'GET /memory': { body: [] },
      'GET /rag/search': { body: [{ id: 'c1', source: 'bible', path: '.claude/BIBLE/physique.md', lines: [10, 24], score: 3.2, text: 'FixedUpdate pour le Rigidbody2D' }] },
      'POST /rag/reindex': { body: { indexed: 12, updated: 3, removed: 1 } },
    })
    renderPage(<MemoryPage />)
    await userEvent.type(screen.getByLabelText('Requête'), 'rigidbody')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))
    expect(await screen.findByText(/physique\.md:L10-24/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Réindexer' }))
    expect(await screen.findByText('12 indexés, 3 mis à jour, 1 retirés')).toBeInTheDocument()
  })

  it('shows the proposals badge and « bientôt disponible » on 404', async () => {
    mockFetch({ 'GET /memory': { body: [memory(1, 'proposed'), memory(2, 'proposed')] } })
    const first = renderPage(<MemoryBadge />)
    expect(await screen.findByLabelText('2 propositions de mémoire')).toBeInTheDocument()
    first.unmount()
    mockFetch({})
    renderPage(<MemoryPage />)
    expect(await screen.findByTestId('coming-soon')).toHaveTextContent('bientôt disponible')
  })
})
