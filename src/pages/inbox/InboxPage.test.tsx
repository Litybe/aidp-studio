import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { InboxEntry, Ticket } from '../../api/types'
import { InboxBadge } from '../../components/InboxBadge'
import { mockApi, renderPage } from '../../test/harness'
import { groupInbox, inboxTotal, parseFlowDecision } from './groups'
import InboxPage from './InboxPage'

const entry = (over: Partial<InboxEntry>): InboxEntry => ({
  kind: 'flow.human',
  action: 'decide',
  title: 'x',
  at: '2026-11-06T10:00:00Z',
  urgency: 5,
  ...over,
})
const merge = entry({ title: 'Merger la PR de GH-12', detail: 'GH-12 / merge_gate', fingerprint: 'f1' })
const overrun = entry({ title: 'Budget dépassé', detail: 'GH-13 / budget_gate', fingerprint: 'f2' })
const question = entry({ kind: 'gate', action: 'reply', title: 'Quel style ?', sessionId: 's1' })
const running = entry({ kind: 'runningSession', action: 'open', title: 'Session en cours' })
const blocked: Ticket = { key: 'GH-14', summary: 'Salle du boss', status: 'blocked: ci-failed', githubNumber: 14 }
const ready: Ticket = { key: 'GH-15', summary: 'Prête', status: 'todo' }

describe('groupInbox', () => {
  it('splits merges, budget, questions and blocked issues, and skips plain running sessions', () => {
    const groups = groupInbox([merge, overrun, question, running], [blocked, ready])
    expect(groups.merges.map((item) => item.key)).toEqual(['GH-12'])
    expect(groups.merges[0]?.stepId).toBe('merge_gate')
    expect(groups.budget.map((item) => item.key)).toEqual(['GH-13'])
    expect(groups.questions).toHaveLength(1)
    expect(groups.blocked.map((ticket) => ticket.key)).toEqual(['GH-14'])
    expect(inboxTotal(groups)).toBe(4)
  })

  it('refuses a flow.human entry whose detail is not "<key> / <step>"', () => {
    expect(parseFlowDecision(entry({ detail: 'n’importe quoi' }))).toBeNull()
  })
})

describe('InboxPage', () => {
  it('merges in one click through the approve route of the gate', async () => {
    const calls = mockApi({
      'GET /inbox': { body: [merge, question] },
      'GET /tickets': { body: [blocked] },
      'GET /sessions/s1': { body: { id: 's1', status: 'running', pendingQuestion: { toolUseId: 't', questions: [{ question: 'Quel style ?', options: [{ label: 'Pixel' }] }] } } },
      'POST /flows/GH-12/steps/merge_gate/approve': { body: { ok: true } },
    })
    renderPage(InboxPage)
    const merges = await screen.findByRole('region', { name: 'Merges à valider' })
    fireEvent.click(within(merges).getByRole('button', { name: 'Merger' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/flows/GH-12/steps/merge_gate/approve')).toBe(true))
    const blockedGroup = screen.getByRole('region', { name: 'Issues bloquées' })
    expect(within(blockedGroup).getByText('ci-failed')).toBeInTheDocument()
    expect(await screen.findByLabelText('Réponse : Quel style ?')).toBeInTheDocument()
  })

  it('answers a session question with the answers body', async () => {
    const calls = mockApi({
      'GET /inbox': { body: [question] },
      'GET /tickets': { body: [] },
      'GET /sessions/s1': { body: { id: 's1', status: 'running', pendingQuestion: { toolUseId: 't', questions: [{ question: 'Quel style ?' }] } } },
      'POST /sessions/s1/reply': { body: { ok: true } },
    })
    renderPage(InboxPage)
    fireEvent.change(await screen.findByLabelText('Réponse : Quel style ?'), { target: { value: 'Pixel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }))
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/sessions/s1/reply')?.body).toEqual({ answers: { 'Quel style ?': { answer: 'Pixel' } } }),
    )
  })

  it('shows the empty state', async () => {
    mockApi({ 'GET /inbox': { body: [] }, 'GET /tickets': { body: [] } })
    renderPage(InboxPage)
    expect(await screen.findByText(/Rien n.attend/)).toBeInTheDocument()
  })
})

describe('InboxBadge', () => {
  it('counts the entries and the blocked issues, like the page', async () => {
    mockApi({ 'GET /inbox': { body: [merge, question, running] }, 'GET /tickets': { body: [blocked, ready] } })
    renderPage(InboxBadge)
    expect(await screen.findByLabelText('3 en attente')).toBeInTheDocument()
  })
})

