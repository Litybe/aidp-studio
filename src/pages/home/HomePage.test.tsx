import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { InboxEntry, Ticket } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import HomePage, { HOME_INBOX_MAX } from './HomePage'
import { pipelineSegments, summarize } from './summary'

const ready: Ticket = { key: 'GH-12', summary: 'Dash en l’air', status: 'todo', labels: ['aidp:ready'], githubNumber: 12 }
const running: Ticket = {
  key: 'GH-13',
  summary: 'Sprite du héros',
  status: 'in-progress',
  route: 'art',
  githubNumber: 13,
  flowSummary: { flowKey: 'GH-13', status: 'running', phase: 'implement', stepId: 'art-produce', iteration: 1, startedAt: new Date(Date.now() - 5 * 60_000).toISOString() },
}
const waiting: Ticket = {
  key: 'GH-14',
  summary: 'Salle du boss',
  status: 'in-progress',
  githubNumber: 14,
  flowSummary: { flowKey: 'GH-14', status: 'waiting_human', phase: 'review', stepId: 'review_gate', iteration: 2, startedAt: null },
}
const blocked: Ticket = { key: 'GH-15', summary: 'HUD cassé', status: 'blocked: ci-failed', githubNumber: 15 }
const merge: InboxEntry = { kind: 'flow.human', action: 'decide', title: 'Merger la PR de GH-14', detail: 'GH-14 / merge_gate', fingerprint: 'f1', at: '2026-11-06T10:00:00Z', urgency: 5 }

describe('summarize', () => {
  it('counts the active flows, the ones waiting for a human and the tickets per column', () => {
    const summary = summarize([ready, running, waiting, blocked])
    expect(summary.active.map((ticket) => ticket.key)).toEqual(['GH-13', 'GH-14'])
    expect(summary.waiting).toBe(1)
    expect(summary.counts.ready).toBe(1)
    expect(summary.counts.realisation).toBe(1)
    expect(summary.counts.blocked).toBe(1)
    expect(summary.total).toBe(4)
  })

  it('spreads the pipeline bar over the non-empty columns only', () => {
    const segments = pipelineSegments(summarize([ready, blocked]))
    expect(segments.map((segment) => segment.id)).toEqual(['ready', 'blocked'])
    expect(segments[0]?.percent).toBe(50)
    expect(pipelineSegments(summarize([]))).toEqual([])
  })
})

describe('HomePage', () => {
  it('shows the numbers that matter and the first decisions with their actions', async () => {
    const calls = mockApi({
      'GET /tickets': { body: [ready, running, waiting, blocked] },
      'GET /inbox': { body: [merge] },
      'GET /projects': { body: [{ id: 'p', name: 'PixelHood', path: 'D:\\PixelHood', runsCount: 3 }] },
      'POST /flows/GH-14/steps/merge_gate/approve': { body: { ok: true } },
      'POST /flows/GH-13/pause': { body: { ok: true } },
    })
    renderPage(HomePage)
    expect(await screen.findByLabelText('À décider : 2')).toBeInTheDocument()
    expect(screen.getByLabelText('En cours : 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Bloquées : 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Prêtes : 1')).toBeInTheDocument()
    expect(screen.getByText(/PixelHood · 4 tickets suivis/)).toBeInTheDocument()

    const decisions = screen.getByRole('region', { name: 'À décider' })
    fireEvent.click(within(decisions).getByRole('button', { name: 'Merger' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/flows/GH-14/steps/merge_gate/approve')).toBe(true))
    expect(within(decisions).getByText('HUD cassé')).toBeInTheDocument()

    const active = screen.getByRole('region', { name: 'En cours' })
    expect(within(active).getByText('Sprite du héros')).toBeInTheDocument()
    expect(within(active).getByText('décision attendue')).toBeInTheDocument()
    expect(within(active).getByText('5 min')).toBeInTheDocument()
    fireEvent.click(within(active).getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/flows/GH-13/pause')).toBe(true))
  })

  it('caps the decisions shown and links to the full inbox', async () => {
    const many = Array.from({ length: HOME_INBOX_MAX + 2 }, (_, index) => ({ ...merge, title: `Merge ${index}`, detail: `GH-${index} / merge_gate`, fingerprint: `f${index}` }))
    mockApi({ 'GET /tickets': { body: [] }, 'GET /inbox': { body: many } })
    renderPage(HomePage)
    expect(await screen.findByRole('link', { name: `Tout voir (${HOME_INBOX_MAX + 2})` })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Merger' })).toHaveLength(HOME_INBOX_MAX)
    expect(screen.getByText('Aucun flow actif.')).toBeInTheDocument()
  })
})
