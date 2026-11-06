import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, renderPage } from '../../test/render'
import ArtPage from './ArtPage'
import { runFileUrl, runIdsOf } from './queries'

afterEach(() => vi.unstubAllGlobals())

describe('Art helpers', () => {
  it('lists unique run ids and encodes file urls', () => {
    expect(runIdsOf({ sessions: { 'a:1:start_pipeline': 'run-1', 'b:1:start_pipeline': 'run-1', c: 'run-2' } })).toEqual(['run-1', 'run-2'])
    expect(runIdsOf(undefined)).toEqual([])
    expect(runFileUrl('r 1', 'generate/hero idle.png')).toBe('/api/runs/r%201/files/generate/hero%20idle.png')
  })
})

describe('Art', () => {
  it('shows only art issues and loads the gallery of an issue on open, lazy and pixelated', async () => {
    const calls = mockFetch({
      'GET /tickets': {
        body: [
          { key: 'GH-7', title: 'Héros idle', route: 'art', flowSummary: { flowKey: 'f7', status: 'running' } },
          { key: 'GH-8', title: 'Code', route: 'code' },
        ],
      },
      'GET /flows/f7': { body: { sessions: { 'generate:1:start_pipeline': 'run-7' } } },
      'GET /runs/run-7/files': {
        body: [
          { path: 'generate/hero.png', size: 2048, kind: 'png', stage: 'generate' },
          { path: 'report.md', size: 100, kind: 'md' },
          { path: 'anim/idle.gif', size: 4096, kind: 'gif' },
        ],
      },
    })
    renderPage(<ArtPage />)
    expect(await screen.findByRole('button', { name: /#7/ })).toBeInTheDocument()
    expect(screen.queryByText('#8')).not.toBeInTheDocument()
    expect(calls.some((call) => call.path.startsWith('/runs/'))).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: /#7/ }))
    const hero = await screen.findByAltText('hero.png')
    expect(hero).toHaveAttribute('loading', 'lazy')
    expect(hero).toHaveAttribute('src', '/api/runs/run-7/files/generate/hero.png')
    expect(hero).toHaveStyle({ imageRendering: 'pixelated' })
    expect(screen.getByAltText('idle.gif')).toBeInTheDocument()
    expect(screen.queryByAltText('report.md')).not.toBeInTheDocument()
  })

  it('shows a discreet « bientôt disponible » on 404', async () => {
    mockFetch({})
    renderPage(<ArtPage />)
    expect(await screen.findByTestId('coming-soon')).toHaveTextContent('bientôt disponible')
  })
})
