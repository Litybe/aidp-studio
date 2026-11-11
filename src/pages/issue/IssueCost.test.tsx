import { render, screen, waitFor, within } from '@testing-library/react'
import type { TicketPr } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import { CostSection } from './CostSection'
import IssuePage from './IssuePage'
import type { CostAmount, IssueCost } from './issueCost'
import { behindLabel, MergeStateBadge, mergeBadge } from './MergeStateBadge'

const amount = (input: number, costUsd: number): CostAmount => ({
  input,
  output: 2,
  cacheRead: 3,
  cacheCreate: 4,
  totalTokens: input + 9,
  costUsd,
})

const COST: IssueCost = {
  key: 'GH-12',
  totals: amount(1000, 3.5),
  runs: [
    {
      ...amount(1000, 3.5),
      runId: 'run-a',
      pipelineId: 'dev-unity',
      startedAt: '2026-11-06T10:00:00Z',
      stages: [
        { ...amount(600, 2), stage: 'implement', agent: 'executor', model: 'claude-sonnet-5' },
        { ...amount(400, 1.5), stage: 'review', agent: 'reviewer', model: null },
      ],
      pixellab: { runId: 'run-a', generations: 4, spent: 12 },
    },
  ],
  byStage: [
    { ...amount(600, 2), key: 'implement', count: 1 },
    { ...amount(400, 1.5), key: 'review', count: 1 },
  ],
  byAgent: [
    { ...amount(600, 2), key: 'executor', count: 1 },
    { ...amount(400, 1.5), key: 'reviewer', count: 1 },
  ],
  sessions: amount(50, 0.25),
  sessionCount: 2,
  pixellab: { generations: 4, credits: 12 },
}

describe('CostSection', () => {
  it('shows the total, the runs, the stages, the agents and the Pixellab credits', async () => {
    mockApi({ 'GET /tickets/GH-12/cost/detail': { body: COST } })
    renderPage(() => <CostSection ticketKey="GH-12" />)
    const section = await screen.findByRole('region', { name: 'Coût' })
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(/3,50\s*\$US/)
    const total = within(section).getByRole('table', { name: 'Total' })
    expect(within(total).getByText('1 run')).toBeInTheDocument()
    expect(within(total).getByText('1 000')).toBeInTheDocument()
    expect(within(total).getByText('Cache lu')).toBeInTheDocument()
    expect(within(section).getByText(/Pixellab : 4 générations · 12 crédits/)).toBeInTheDocument()
    expect(within(section).getByText('dev-unity')).toBeInTheDocument()
    const stages = within(section).getByRole('table', { name: 'Par étape' })
    expect(within(stages).getByText('implement')).toBeInTheDocument()
    const agents = within(section).getByRole('table', { name: 'Par agent' })
    expect(within(agents).getByText('reviewer')).toBeInTheDocument()
    expect(within(section).getByRole('table', { name: 'Étapes du run run-a', hidden: true })).toBeInTheDocument()
    expect(within(section).getByText(/Sessions de l'issue .* 2 · 59 tokens/)).toBeInTheDocument()
  })

  it('says so when nothing is recorded and renders nothing when the route is missing', async () => {
    mockApi({
      'GET /tickets/GH-12/cost/detail': {
        body: { ...COST, runs: [], byStage: [], byAgent: [], sessionCount: 0, totals: amount(0, 0), pixellab: null },
      },
    })
    const first = renderPage(() => <CostSection ticketKey="GH-12" />)
    expect(await screen.findByText('Aucun coût enregistré pour cette issue.')).toBeInTheDocument()
    first.unmount()
    const calls = mockApi({})
    const { container } = renderPage(() => <CostSection ticketKey="GH-13" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(container.querySelector('section[aria-label="Coût"]')).toBeNull()
  })
})

describe('merge badge', () => {
  const open = (extra: Partial<TicketPr>): TicketPr => ({ number: 4, state: 'open', ...extra })

  it('flags conflicts in red, from mergeable or from the merge state', () => {
    expect(mergeBadge(open({ mergeable: 'conflicting' }))).toMatchObject({ label: 'Conflits', tone: 'danger' })
    expect(mergeBadge(open({ mergeStateStatus: 'dirty' }))).toMatchObject({ label: 'Conflits', tone: 'danger' })
  })

  it('shows Mergeable, and Inconnu / en calcul while GitHub has not answered', () => {
    expect(mergeBadge(open({ mergeable: 'mergeable', mergeStateStatus: 'clean' }))).toMatchObject({ label: 'Mergeable', tone: 'ok' })
    expect(mergeBadge(open({ mergeable: 'unknown' }))?.label).toBe('Inconnu / en calcul')
    expect(mergeBadge(open({}))?.label).toBe('Inconnu / en calcul')
  })

  it('shows nothing for a merged or closed PR, or without a PR', () => {
    expect(mergeBadge(open({ state: 'merged', mergeable: 'conflicting' }))).toBeNull()
    expect(mergeBadge(undefined)).toBeNull()
  })

  it('tells how far behind the base the branch is', () => {
    expect(behindLabel(open({ behindBy: 3 }))).toBe('En retard de 3 commits')
    expect(behindLabel(open({ behindBy: 1 }))).toBe('En retard de 1 commit')
    expect(behindLabel(open({ mergeStateStatus: 'behind' }))).toBe('En retard sur la base')
    expect(behindLabel(open({ behindBy: 0, mergeStateStatus: 'clean' }))).toBeNull()
    render(<MergeStateBadge pr={open({ mergeable: 'mergeable', behindBy: 2 })} />)
    expect(screen.getByText('Mergeable')).toBeInTheDocument()
    expect(screen.getByText('En retard de 2 commits')).toBeInTheDocument()
  })
})

describe('IssuePage cost and conflicts', () => {
  it('shows the conflict badge in the header and the cost section', async () => {
    mockApi({
      'GET /tickets/GH-12': { body: { ticket: { key: 'GH-12', summary: 'Dash', status: 'in-review', githubNumber: 12, route: 'code' }, body: '' } },
      'GET /tickets/GH-12/pr': { body: { number: 40, state: 'open', mergeable: 'conflicting', mergeStateStatus: 'dirty', behindBy: 2 } },
      'GET /tickets/GH-12/cost/detail': { body: COST },
    })
    renderPage(IssuePage, { pattern: '/issue/$key', url: '/issue/GH-12' })
    expect(await screen.findByText('Conflits')).toBeInTheDocument()
    expect(await screen.findByText('En retard de 2 commits')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Coût' })).toBeInTheDocument()
  })
})
