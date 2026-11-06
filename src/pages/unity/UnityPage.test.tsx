import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnityIndicator } from '../../components/UnityIndicator'
import type { UnityStatus } from '../../api/types/unity'
import { mockFetch, renderPage } from '../../test/render'
import UnityPage from './UnityPage'
import { unitySummary } from './queries'

const STATUS: UnityStatus = {
  editor: { running: true, pid: 21156, projectPath: 'D:/CLAUDE_UNITY/proj' },
  lock: { held: true, holder: { flowKey: 'f1', ticketKey: 'GH-214', stepId: 'implement', since: '2026-11-06T10:00:00Z' } },
  lastCompile: {
    id: 'c1',
    ok: false,
    errors: [{ file: 'Assets/Player.cs', line: 12, message: 'CS0103: nom introuvable' }],
    warnings: 3,
    durationMs: 8400,
    finishedAt: '2026-11-06T16:00:00Z',
  },
  lastPlaytest: { id: 'p1', passed: true, finishedAt: '2026-11-06T16:10:00Z' },
}

afterEach(() => vi.unstubAllGlobals())

describe('Unity', () => {
  it('summarises the editor and the lock for the top bar', () => {
    expect(unitySummary(STATUS).text).toBe('ouvert, verrou #214')
    expect(unitySummary({ ...STATUS, lock: { held: false, holder: null } }).text).toBe('ouvert')
    expect(unitySummary({ ...STATUS, editor: { running: false, pid: null, projectPath: null } }).text).toBe('fermé')
  })

  it('shows « inconnu » in the top bar while the route is missing, then the lock', async () => {
    mockFetch({})
    const first = renderPage(<UnityIndicator />)
    await waitFor(() => expect(screen.getByText('Unity : inconnu')).toBeInTheDocument())
    first.unmount()
    mockFetch({ 'GET /unity/status': { body: STATUS } })
    renderPage(<UnityIndicator />)
    expect(await screen.findByText('Unity : ouvert, verrou #214')).toBeInTheDocument()
  })

  it('lists the compile errors as file:line and releases the lock only after confirmation', async () => {
    const calls = mockFetch({ 'GET /unity/status': { body: STATUS }, 'POST /unity/lock/release': { body: { ok: true } } })
    renderPage(<UnityPage />)
    expect(await screen.findByText('Assets/Player.cs:12')).toBeInTheDocument()
    expect(screen.getByText('implement')).toBeInTheDocument()
    expect(screen.getByText(/P7/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Libérer' }))
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la libération' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/unity/lock/release')).toBe(true))
  })

  it('shows a discreet « bientôt disponible » on 404', async () => {
    mockFetch({})
    renderPage(<UnityPage />)
    expect(await screen.findByTestId('coming-soon')).toHaveTextContent('bientôt disponible')
  })
})
