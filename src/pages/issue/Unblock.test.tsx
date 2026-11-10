import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FlowRun, Ticket } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import BoardPage from '../board/BoardPage'
import IssuePage from './IssuePage'
import { isFlowStuck, isStepUnblockable, recoveryOf, STUCK_AFTER_MS } from './unblockState'

const TO_TEST = { status: 'in-progress', phase: 'to-test', reason: 'remis en test depuis le studio', force: true }
const TO_DEV = { status: 'todo', phase: 'dev', reason: 'remis en dev depuis le studio', force: true }

function flowOf(status: FlowRun['status'], stepStatus: FlowRun['steps'][string]['status'] = 'escalated'): FlowRun {
  return {
    key: 'GH-227',
    def: { id: 'dev-unity', version: 1, steps: [{ id: 'plan', phase: 'plan' }, { id: 'implement', phase: 'realisation' }] },
    status,
    current: 'implement',
    steps: { plan: { status: 'done' }, implement: { status: stepStatus, started_at: '2026-11-06T10:05:00Z' } },
    repo: 'org/game',
  }
}

const ticket = (extra: Partial<Ticket> = {}): Ticket => ({
  key: 'GH-227',
  summary: 'Boss',
  status: 'in-progress',
  githubNumber: 227,
  route: 'code',
  flowSummary: { flowKey: 'GH-227', status: 'escalated', phase: 'realisation', stepId: 'implement', iteration: 1, startedAt: null },
  ...extra,
})

const summary = (status: string) => ({ flowKey: 'GH-227', status, phase: null, stepId: 'implement', iteration: 1, startedAt: null })

const routesFor = (flow: FlowRun, t: Ticket = ticket()) => ({
  'GET /tickets/GH-227': { body: { ticket: t, body: '' } },
  'GET /flows/GH-227': { body: flow },
  'POST /flows/GH-227/steps/implement/retry': { body: { ok: true } },
  'POST /flows/GH-227/steps/implement/skip': { body: { ok: true } },
  'POST /flows/GH-227/resume': { body: { ok: true } },
  'POST /flows/GH-227/abort': { body: { ok: true } },
  'POST /tickets/GH-227/status': { body: { ok: true } },
  'POST /prs/update-branch': { body: { ok: true } },
})
const renderIssue = () => renderPage(IssuePage, { pattern: '/issue/$key', url: '/issue/GH-227' })
const posts = (calls: { method: string; path: string; body: unknown }[]) => calls.filter((call) => call.method === 'POST')

describe('unblock state', () => {
  it('limits step actions to failed, escalated, waiting_external and running steps of a live flow', () => {
    for (const status of ['failed', 'escalated', 'waiting_external', 'running']) expect(isStepUnblockable('failed', status)).toBe(true)
    for (const status of ['pending', 'done', 'skipped', 'waiting_human']) expect(isStepUnblockable('running', status)).toBe(false)
    expect(isStepUnblockable('done', 'failed')).toBe(false)
    expect(isStepUnblockable('aborted', 'running')).toBe(false)
  })

  it('takes a step running for over 30 minutes for stuck', () => {
    const facts = { key: 'k', status: 'running', stepId: 's', stepStartedAt: '2026-11-06T10:00:00Z' }
    const start = Date.parse('2026-11-06T10:00:00Z')
    expect(isFlowStuck(facts, start + STUCK_AFTER_MS - 1)).toBe(false)
    expect(isFlowStuck(facts, start + STUCK_AFTER_MS + 1)).toBe(true)
    expect(isFlowStuck({ ...facts, status: 'paused' }, start + STUCK_AFTER_MS * 5)).toBe(false)
  })

  it('offers nothing for a healthy ticket and everything for a dead flow', () => {
    const healthy = ticket({ flowSummary: summary('running') })
    expect(recoveryOf(healthy, { key: 'GH-227', status: 'running', stepId: 's' }, false).needed).toBe(false)
    const dead = recoveryOf(ticket(), { key: 'GH-227', status: 'escalated', stepId: 's' }, false)
    expect(dead).toEqual({ needed: true, abort: true, resetTicket: true, abortAndTest: true })
    const noFlow = recoveryOf(ticket({ status: 'blocked', flowSummary: null }), null, false)
    expect(noFlow).toEqual({ needed: true, abort: false, resetTicket: true, abortAndTest: false })
  })
})

describe('IssuePage unblock', () => {
  it('retries a step without a body and skips it only after confirmation', async () => {
    const calls = mockApi(routesFor(flowOf('escalated')))
    renderIssue()
    const row = (await screen.findByText('implement')).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: "Relancer l'étape" }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/flows/GH-227/steps/implement/retry', body: undefined }))
    fireEvent.click(within(row).getByRole('button', { name: "Passer l'étape" }))
    expect(calls.some((call) => call.path.endsWith('/skip'))).toBe(false)
    fireEvent.click(within(row).getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/flows/GH-227/steps/implement/skip')).toBe(true))
  })

  it('shows the Débloquer block on an escalated flow and puts the ticket back in test or dev with force', async () => {
    const calls = mockApi(routesFor(flowOf('escalated')))
    renderIssue()
    const block = await screen.findByRole('region', { name: 'Débloquer' })
    fireEvent.click(within(block).getByRole('button', { name: 'Remettre en test' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/tickets/GH-227/status', body: TO_TEST }))
    fireEvent.click(within(block).getByRole('button', { name: 'Remettre en dev' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/tickets/GH-227/status', body: TO_DEV }))
  })

  it('aborts the flow after confirmation', async () => {
    const calls = mockApi(routesFor(flowOf('failed', 'failed')))
    renderIssue()
    const block = await screen.findByRole('region', { name: 'Débloquer' })
    fireEvent.click(within(block).getByRole('button', { name: 'Annuler le flow' }))
    expect(calls.some((call) => call.path.endsWith('/abort'))).toBe(false)
    fireEvent.click(within(block).getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/flows/GH-227/abort', body: undefined }))
  })

  it('aborts then puts back in test, in that order, after confirmation', async () => {
    const calls = mockApi(routesFor(flowOf('escalated')))
    renderIssue()
    const block = await screen.findByRole('region', { name: 'Débloquer' })
    fireEvent.click(within(block).getByRole('button', { name: 'Annuler le flow et remettre en test' }))
    expect(posts(calls)).toHaveLength(0)
    fireEvent.click(within(block).getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(posts(calls).map((call) => call.path)).toEqual(['/flows/GH-227/abort', '/tickets/GH-227/status']))
    expect(posts(calls)[1]?.body).toEqual(TO_TEST)
  })

  it('shows the daemon 409 and does not move the ticket when the abort fails', async () => {
    const calls = mockApi({
      ...routesFor(flowOf('escalated')),
      'POST /flows/GH-227/abort': { status: 409, body: { error: 'flow déjà terminé', code: 'conflict' } },
    })
    renderIssue()
    const block = await screen.findByRole('region', { name: 'Débloquer' })
    fireEvent.click(within(block).getByRole('button', { name: 'Annuler le flow et remettre en test' }))
    fireEvent.click(within(block).getByRole('button', { name: 'Oui, confirmer' }))
    expect(await within(block).findByText('flow déjà terminé')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/tickets/GH-227/status' && call.method === 'POST')).toBe(false)
  })

  it('resumes a pausing flow and shows the block', async () => {
    const calls = mockApi(routesFor(flowOf('pausing', 'running'), ticket({ flowSummary: summary('pausing') })))
    renderIssue()
    expect(await screen.findByRole('region', { name: 'Débloquer' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre le flow' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/flows/GH-227/resume', body: undefined }))
  })

  it('updates the PR branch with repo and number', async () => {
    const calls = mockApi({
      ...routesFor(flowOf('waiting_human', 'waiting_human'), ticket({ flowSummary: summary('waiting_human') })),
      'GET /tickets/GH-227/pr': { body: { number: 41, repo: 'org/game', state: 'open' } },
    })
    renderIssue()
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre à jour la branche' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/prs/update-branch', body: { repo: 'org/game', number: 41 } }))
  })

  it('shows no Débloquer block and no step actions on a healthy waiting flow, only a plain abort', async () => {
    mockApi(routesFor(flowOf('waiting_human', 'waiting_human'), ticket({ flowSummary: summary('waiting_human') })))
    renderIssue()
    expect(await screen.findByRole('button', { name: 'Annuler le flow' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Débloquer' })).toBeNull()
    expect(screen.queryByRole('button', { name: "Relancer l'étape" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remettre en test' })).toBeNull()
  })
})

describe('Board card unblock', () => {
  it('offers the recovery actions on a blocked card with the right routes and bodies', async () => {
    const calls = mockApi({ ...routesFor(flowOf('escalated')), 'GET /tickets': { body: [ticket()] }, 'GET /queue': { body: [] } })
    renderPage(BoardPage)
    fireEvent.click(await screen.findByLabelText('Actions #227'))
    fireEvent.click(screen.getByRole('button', { name: "Relancer l'étape" }))
    await waitFor(() => expect(calls.some((call) => call.path === '/flows/GH-227/steps/implement/retry')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Remettre en test' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/tickets/GH-227/status', body: TO_TEST }))
    fireEvent.click(screen.getByRole('button', { name: 'Remettre en dev' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/tickets/GH-227/status', body: TO_DEV }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le flow et remettre en test' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(posts(calls).filter((call) => call.path === '/flows/GH-227/abort')).toHaveLength(1))
  })

  it('shows none of them on a healthy ready card, and a dispatcher tick button on the toolbar', async () => {
    const ready: Ticket = { key: 'GH-12', summary: 'Dash', status: 'todo', labels: ['aidp:ready'], githubNumber: 12, route: 'code' }
    const calls = mockApi({ 'GET /tickets': { body: [ready] }, 'GET /queue': { body: [] }, 'POST /dispatcher/tick': { body: { ok: true } } })
    renderPage(BoardPage)
    fireEvent.click(await screen.findByLabelText('Actions #12'))
    expect(screen.queryByRole('button', { name: 'Remettre en test' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Annuler le flow' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lancer un passage' }))
    await waitFor(() => expect(posts(calls)).toContainEqual({ method: 'POST', path: '/dispatcher/tick', body: undefined }))
  })
})
