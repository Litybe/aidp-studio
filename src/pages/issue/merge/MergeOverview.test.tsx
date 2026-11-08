import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FlowRun } from '../../../api/types'
import { mockApi, renderPage } from '../../../test/harness'
import IssuePage from '../IssuePage'

const flow: FlowRun = {
  key: 'GH-9',
  def: {
    id: 'game-test-art',
    version: 1,
    steps: [
      { id: 'test', phase: 'Test Unity' },
      { id: 'merge_approval', phase: 'Merge', kind: 'human', prompt: 'Merger la PR ?' },
    ],
  },
  status: 'waiting_human',
  current: 'merge_approval',
  steps: { test: { status: 'done' }, merge_approval: { status: 'waiting_human' } },
  sessions: { 'review:0:start_pipeline': 'run-b', 'produce:0:start_pipeline': 'run-a', 'test:0:start_pipeline': 'run-c' },
  pr: { number: 7, repository: 'Litybe/PixelHood' },
}

const BODY = `## Critères d'acceptation
- [ ] **CA-1** — le canevas fait 24x24
- [ ] **CA-2** — pas de tag
- [ ] **CA-3** — import Unity
- [ ] **CA-4** — aucun résultat
`

const ticket = (route: string) => ({
  body: { ticket: { key: 'GH-9', summary: 'Cadre du menu', status: 'in-review', githubNumber: 9, route }, body: BODY },
})

const SHA = 'abcdef1234567890'
const PR = { body: { number: 7, repo: 'Litybe/PixelHood', head: { ref: 'feat/GH-9', sha: SHA }, state: 'open' } }

const art = {
  'GET /tickets/GH-9': ticket('art'),
  'GET /flows/GH-9': { body: flow },
  'GET /tickets/GH-9/pr': PR,
  'GET /prs/files?repo=Litybe%2FPixelHood&number=7': {
    body: {
      files: [
        { filename: 'Assets/Sprites/UI/Pause/pause_frame.png', status: 'added', additions: 0, deletions: 0, patch: null, previousFilename: null, sha: 'x', tooLarge: true },
        { filename: 'Assets/Sprites/UI/Pause/pause_frame.aseprite', status: 'added', additions: 0, deletions: 0, patch: null, previousFilename: null, sha: 'y', tooLarge: true },
      ],
      hasMore: false,
      page: 1,
      perPage: 100,
    },
  },
  'GET /runs/run-a/files': { body: [{ path: 'verify/findings.json', size: 10, kind: 'json', stage: 'verify' }, { path: 'brief/brief.json', size: 10, kind: 'json', stage: 'brief' }] },
  'GET /runs/run-b/files': { body: [{ path: 'review/findings.json', size: 10, kind: 'json', stage: 'review' }] },
  'GET /runs/run-c/files': { body: [{ path: 'test/playtest.json', size: 10, kind: 'json', stage: 'test' }] },
  'GET /runs/run-a/files/verify/findings.json': {
    text: JSON.stringify({ criteria: [{ id: 'CA-1', status: 'fail', proof: 'ancien: 23x23' }, { id: 'CA-2', status: 'ok', proof: 'tag_list vide' }] }),
  },
  'GET /runs/run-b/files/review/findings.json': {
    text: '\uFEFF' + JSON.stringify({ criteria: [{ id: 'CA-1', status: '✅', proof: 'sprite_inspect 24x24' }, { id: 'CA-3', status: '🧪', proof: 'reporté' }] }),
  },
  'GET /runs/run-c/files/test/playtest.json': { text: JSON.stringify({ scenarios: [{ id: 'issue-9-ca3', criterion: 'CA-3', result: 'pass', asserts: ['ppu = 16'] }] }) },
}

const render9 = () => renderPage(IssuePage, { pattern: '/issue/$key', url: '/issue/GH-9' })

describe('merge overview', () => {
  it('shows the final image from the head of the PR, then the criteria with their result', async () => {
    mockApi(art)
    render9()
    const overview = await screen.findByTestId('merge-overview')
    expect(screen.getByRole('button', { name: 'Approuver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()

    const images = await within(overview).findAllByRole('img', { name: /pause_frame\.png/ })
    const raw = `https://raw.githubusercontent.com/Litybe/PixelHood/${SHA}/Assets/Sprites/UI/Pause/pause_frame.png`
    expect(images[0]).toHaveAttribute('src', `/api/github/asset?url=${encodeURIComponent(raw)}`)
    expect(images[0]).toHaveStyle({ imageRendering: 'pixelated' })
    expect(within(overview).queryByRole('img', { name: /aseprite/ })).toBeNull()

    const table = await within(overview).findByRole('table', { name: "Critères d'acceptation" })
    await waitFor(() => expect(within(table).getByText('sprite_inspect 24x24')).toBeInTheDocument())
    const row = (id: string) => within(table).getAllByRole('row').find((r) => within(r).queryByText(id))!
    expect(row('CA-1')).toHaveTextContent('réussi')
    expect(row('CA-2')).toHaveTextContent('réussi')
    expect(row('CA-3')).toHaveTextContent('réussi')
    expect(row('CA-3')).toHaveTextContent('ppu = 16')
    expect(row('CA-4')).toHaveTextContent('non vérifié')
    expect(row('CA-4')).not.toHaveTextContent('réussi')
  })

  it('shows the code of the PR for a code ticket: counts, small diff open, big one folded and loaded on demand', async () => {
    const calls = mockApi({
      ...art,
      'GET /tickets/GH-9': ticket('code'),
      'GET /prs/files?repo=Litybe%2FPixelHood&number=7': {
        body: {
          files: [
            { filename: 'Assets/Scripts/A.cs', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1,2 +1,2 @@\n keep\n-old line\n+new line', previousFilename: null, sha: 'x', tooLarge: false },
            { filename: 'Assets/Scripts/Big.cs', status: 'modified', additions: 300, deletions: 0, patch: null, previousFilename: null, sha: 'y', tooLarge: true },
          ],
          hasMore: false,
          page: 1,
          perPage: 100,
        },
      },
      'GET /prs/file-diff?repo=Litybe%2FPixelHood&number=7&path=Assets%2FScripts%2FBig.cs': { body: { path: 'Assets/Scripts/Big.cs', diff: '@@ -0,0 +1 @@\n+gros fichier' } },
    })
    render9()
    expect(await screen.findByText('+new line')).toBeInTheDocument()
    expect(screen.getByText('-old line')).toBeInTheDocument()
    expect(screen.getByText(/2 fichiers/)).toBeInTheDocument()
    expect(screen.queryByText('+gros fichier')).toBeNull()
    expect(calls.some((c) => c.path.includes('file-diff'))).toBe(false)
    fireEvent.click(screen.getByText('Assets/Scripts/Big.cs'))
    expect(await screen.findByText('+gros fichier')).toBeInTheDocument()
  })

  it('keeps the old page when the waiting step is not merge_approval', async () => {
    const other: FlowRun = { ...flow, def: { ...flow.def, steps: [{ id: 'merge_gate', kind: 'human' }] }, current: 'merge_gate', steps: { merge_gate: { status: 'waiting_human' } } }
    mockApi({ ...art, 'GET /flows/GH-9': { body: other } })
    render9()
    expect(await screen.findByRole('button', { name: 'Approuver' })).toBeInTheDocument()
    expect(screen.queryByTestId('merge-overview')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Artefacts' })).toBeInTheDocument()
  })
})
