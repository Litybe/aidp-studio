import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderPage } from '../../test/harness'
import ArtPage, { groupByIssue } from './ArtPage'
import { assetsPath } from './queries'

afterEach(() => vi.restoreAllMocks())

const img = (path: string, stage: string) => ({ path, size: 2048, kind: 'png', stage })
const run = (runId: string, ticket: string | undefined, status: string, extra: Record<string, unknown> = {}) => ({
  runId,
  templateId: 'art-produce',
  status,
  ...(ticket ? { ticket } : {}),
  startedAt: '2026-11-08T10:00:00Z',
  cover: img('export/final.png', 'export'),
  images: [img('generate/raw.png', 'generate'), img('fix/fixed.png', 'fix'), img('export/final.png', 'export')],
  ...extra,
})
const tickets = [
  { key: 'GH-7', title: 'Héros idle', route: 'art' },
  { key: 'GH-8', title: 'Code', route: 'code' },
]

describe('Art helpers', () => {
  it('builds the query string without empty filters and groups runs by issue', () => {
    expect(assetsPath({ status: '', issue: '', q: ' ' }, null)).toBe('/art/assets?limit=24')
    expect(assetsPath({ status: 'done', issue: 'GH-7', q: 'hero' }, 'c1')).toBe('/art/assets?limit=24&before=c1&status=done&issue=GH-7&q=hero')
    const groups = groupByIssue([run('a', 'GH-7', 'done'), run('b', undefined, 'done'), run('c', 'GH-7', 'failed')] as never)
    expect(groups.map((g) => [g.ticket, g.runs.length])).toEqual([['GH-7', 2], ['', 1]])
  })
})

describe('Art', () => {
  it('shows finished and failed runs grouped by issue with status, score and links', async () => {
    mockApi({
      'GET /tickets': { body: tickets },
      'GET /art/assets?limit=24': { body: { runs: [run('run-1', 'GH-7', 'done', { score: 8.5 }), run('run-2', 'GH-7', 'failed')], next: null } },
    })
    renderPage(ArtPage, { pattern: '/art', url: '/art' })
    const group = await screen.findByRole('region', { name: /#7 Héros idle/ })
    const done = within(group).getByRole('article', { name: 'Run run-1' })
    expect(within(done).getByText('Terminé')).toBeInTheDocument()
    expect(within(done).getByText('8.5/10')).toBeInTheDocument()
    expect(within(done).getByRole('link', { name: 'Issue' })).toHaveAttribute('href', '/issue/GH-7')
    const cover = within(done).getByAltText('final.png')
    expect(cover).toHaveAttribute('src', '/api/runs/run-1/files/export/final.png')
    expect(cover).toHaveAttribute('loading', 'lazy')
    expect(cover).toHaveStyle({ imageRendering: 'pixelated' })
    expect(within(group).getByText('Échoué')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Code/ })).not.toBeInTheDocument()
  })

  it('opens the detail with every stage, and refetches with the filters', async () => {
    const calls = mockApi({
      'GET /tickets': { body: tickets },
      'GET /art/assets?limit=24': { body: { runs: [run('run-1', 'GH-7', 'done')], next: null } },
      'GET /art/assets?limit=24&status=failed': { body: { runs: [], next: null } },
    })
    renderPage(ArtPage, { pattern: '/art', url: '/art' })
    await userEvent.click(await screen.findByRole('button', { name: /Détail \(3\)/ }))
    const detail = screen.getByRole('region', { name: 'Détail du run run-1' })
    for (const stage of ['generate', 'fix', 'export']) expect(within(detail).getByLabelText(`Étape ${stage}`)).toBeInTheDocument()
    expect(within(detail).getByAltText('raw.png')).toHaveAttribute('src', '/api/runs/run-1/files/generate/raw.png')
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'failed')
    expect(await screen.findByText('aucun sprite pour ces filtres')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/art/assets?limit=24&status=failed')).toBe(true)
  })

  it('loads the next page on demand', async () => {
    const calls = mockApi({
      'GET /tickets': { body: tickets },
      'GET /art/assets?limit=24': { body: { runs: [run('run-1', 'GH-7', 'done')], next: 'cur-1' } },
      'GET /art/assets?limit=24&before=cur-1': { body: { runs: [run('run-0', 'GH-7', 'done')], next: null } },
    })
    renderPage(ArtPage, { pattern: '/art', url: '/art' })
    await userEvent.click(await screen.findByRole('button', { name: 'Charger plus' }))
    expect(await screen.findByRole('article', { name: 'Run run-0' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument()
    expect(calls.filter((call) => call.path.startsWith('/art/assets'))).toHaveLength(2)
  })

  it('shows a discreet « bientôt disponible » on 404', async () => {
    mockApi({})
    renderPage(ArtPage, { pattern: '/art', url: '/art' })
    expect(await screen.findByTestId('coming-soon')).toHaveTextContent('bientôt disponible')
  })
})
