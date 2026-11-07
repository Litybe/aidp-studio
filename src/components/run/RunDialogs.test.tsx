import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { Ticket } from '../../api/types'
import BoardPage from '../../pages/board/BoardPage'
import { mockApi, renderPage } from '../../test/harness'
import { NewRunButton } from './LaunchButtons'

const routing = {
  defaults: {},
  rules: [],
  repos: { code: { flow: 'game-code', route: 'code' }, art: { flow: 'game-art', route: 'art' } },
}
const flows = [{ id: 'game-code' }, { id: 'game-art' }]
const templates = [
  {
    id: 'dev',
    inputs: [
      { name: 'goal', label: 'Objectif', required: true },
      { name: 'notes', type: 'text' },
      { name: 'dry', type: 'boolean', label: 'À blanc' },
    ],
  },
  { id: 'doc' },
]
const budget = { budget: { per_ticket: { code: 0, art: 400000, map: 0, doc: 0, default: 0 } }, dispatcher: {} }

const base: Ticket = { key: 'GH-12', summary: 'Dash', status: 'todo', labels: [], route: 'art', flowSummary: null }
const blocked: Ticket = { ...base, key: 'GH-13', status: 'blocked: attend GH-9', route: 'code' }

const common = {
  'GET /catalog/flows': { body: flows },
  'GET /catalog/templates': { body: templates },
  'GET /settings/routing': { body: routing },
  'GET /settings/budget': { body: budget },
  'GET /queue': { body: [] },
}

async function openCardDialog(ticket: Ticket) {
  renderPage(BoardPage)
  fireEvent.click(await screen.findByLabelText(`Actions #${ticket.key.replace('GH-', '')}`))
  fireEvent.click(await screen.findByRole('button', { name: 'Lancer…' }))
  return screen.findByRole('dialog', {}, { timeout: 8000 })
}

vi.setConfig({ testTimeout: 15000 })

describe('ticket run dialog', () => {
  it('preselects the flow of the route and sends the exact body', async () => {
    const calls = mockApi({
      ...common,
      'GET /tickets': { body: [base] },
      'POST /tickets/GH-12/start': { body: { flowKey: 'GH-12', runId: 'r1' } },
    })
    await openCardDialog(base)
    const select = (await screen.findByLabelText('Flow *')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('game-art'))
    expect(await screen.findByText(/Plafond de la route art/)).toBeInTheDocument()
    expect(screen.getByLabelText('Forcer')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/tickets/GH-12/start')).toBe(true))
    const post = calls.find((c) => c.path === '/tickets/GH-12/start')
    expect(post?.body).toEqual({ flow: 'game-art', track: 'standard' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('checks Forcer for a blocked ticket and sends a template alone', async () => {
    const calls = mockApi({
      ...common,
      'GET /tickets': { body: [blocked] },
      'POST /tickets/GH-13/start': { body: {} },
    })
    await openCardDialog(blocked)
    expect(screen.getByLabelText('Forcer')).toBeChecked()
    expect(screen.getByText(/Ticket bloqué ou non prêt/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Pipeline seul'))
    fireEvent.change(screen.getByLabelText('Track'), { target: { value: 'bug' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/tickets/GH-13/start')).toBe(true))
    expect(calls.find((c) => c.path === '/tickets/GH-13/start')?.body).toEqual({
      template: 'dev',
      track: 'bug',
      force: true,
    })
  })

  it('shows a 400 in the dialog and keeps it open; Escape closes', async () => {
    mockApi({
      ...common,
      'GET /tickets': { body: [base] },
      'POST /tickets/GH-12/start': { status: 400, body: { error: 'flow inconnu', errors: ['flow: introuvable'] } },
    })
    await openCardDialog(base)
    await waitFor(() => expect((screen.getByLabelText('Flow *') as HTMLSelectElement).value).toBe('game-art'))
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))
    expect(await screen.findByText('flow inconnu')).toBeInTheDocument()
    expect(screen.getByText('flow: introuvable')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('global run dialog', () => {
  it('builds the form from the declared inputs and posts them', async () => {
    const calls = mockApi({
      'GET /catalog/templates': { body: templates },
      'GET /projects': { body: [{ id: 'p1', name: 'Jeu', path: 'D:/jeu', runsCount: 0 }] },
      'POST /runs/start': { status: 202, body: { runId: 'r9' } },
    })
    renderPage(NewRunButton)
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau run' }))
    const goal = await screen.findByLabelText('Objectif *')
    expect(screen.getByLabelText('notes')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Lancer' })
    expect(submit).toBeDisabled()
    fireEvent.change(goal, { target: { value: 'sauter' } })
    fireEvent.click(screen.getByLabelText('À blanc'))
    await waitFor(() => expect(submit).toBeEnabled())
    await waitFor(() => expect((screen.getByLabelText('Projet') as HTMLSelectElement).value).toBe('p1'))
    fireEvent.click(submit)
    await waitFor(() => expect(calls.some((c) => c.path === '/runs/start')).toBe(true))
    expect(calls.find((c) => c.path === '/runs/start')?.body).toEqual({
      template: 'dev',
      inputs: { goal: 'sauter', dry: true },
      track: 'standard',
      project: 'p1',
    })
  })
})
