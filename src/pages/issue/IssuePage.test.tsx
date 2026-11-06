import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FlowRun } from '../../api/types'
import { mockApi, renderPage } from '../../test/harness'
import IssuePage from './IssuePage'
import { Markdown, parseMarkdown } from './markdown'
import { linesOfEvent, STREAM_CAPACITY, StreamBuffer } from './stream'
import { buildTimeline, runIdsOf, sessionOfStep } from './flowTimeline'

const flow: FlowRun = {
  key: 'GH-12',
  def: {
    id: 'dev-unity',
    version: 1,
    steps: [
      { id: 'plan', phase: 'plan' },
      { id: 'implement', phase: 'realisation' },
      { id: 'merge_gate', phase: 'merge', kind: 'human' },
    ],
  },
  status: 'waiting_human',
  current: 'merge_gate',
  steps: {
    plan: { status: 'done', started_at: '2026-11-06T10:00:00Z', finished_at: '2026-11-06T10:05:00Z', outputs: { tokens: 1200 } },
    implement: { status: 'done', iteration: 2, started_at: '2026-11-06T10:05:00Z', finished_at: '2026-11-06T11:10:00Z' },
    merge_gate: { status: 'waiting_human' },
  },
  sessions: { 'plan:1:start_pipeline': 'run-a', 'implement:1:start_pipeline': 'run-b' },
}

const ROUTES = {
  'GET /tickets/GH-12': { body: { ticket: { key: 'GH-12', summary: 'Dash en l’air', status: 'in-review', githubNumber: 12, route: 'code' }, body: '' } },
  'GET /flows/GH-12': { body: flow },
}
const render12 = () => renderPage(IssuePage, { pattern: '/issue/$key', url: '/issue/GH-12' })

describe('timeline', () => {
  it('groups the steps by phase with duration, tokens and iteration', () => {
    const phases = buildTimeline(flow)
    expect(phases.map((phase) => phase.phase)).toEqual(['plan', 'realisation', 'merge'])
    expect(phases[0]?.steps[0]?.tokens).toBe(1200)
    expect(phases[1]?.steps[0]?.iteration).toBe(2)
    expect(phases[2]?.steps[0]?.status).toBe('waiting_human')
  })

  it('finds the run of a step and the distinct runs of the flow', () => {
    expect(sessionOfStep(flow, 'implement')).toBe('run-b')
    expect(sessionOfStep(flow, 'merge_gate')).toBeNull()
    expect(runIdsOf(flow)).toEqual(['run-a', 'run-b'])
  })
})

describe('session stream buffer', () => {
  it('keeps only the last lines, whatever the volume', () => {
    const buffer = new StreamBuffer()
    for (let index = 0; index < STREAM_CAPACITY * 3; index += 1) buffer.push([{ kind: 'text', text: `l${index}` }])
    const lines = buffer.snapshot()
    expect(lines).toHaveLength(STREAM_CAPACITY)
    expect(lines[0]?.text).toBe(`l${STREAM_CAPACITY * 2}`)
    expect(lines.at(-1)?.text).toBe(`l${STREAM_CAPACITY * 3 - 1}`)
    expect(buffer.total).toBe(STREAM_CAPACITY * 3)
  })

  it('reads text, tool, question and done events', () => {
    const assistant = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Je lis le plan' }, { type: 'tool_use', name: 'Read' }, { type: 'tool_use', name: 'AskUserQuestion' }] },
    }
    expect(linesOfEvent(assistant).map((line) => line.kind)).toEqual(['text', 'tool', 'question'])
    expect(linesOfEvent({ type: 'done', status: 'done' })[0]?.kind).toBe('done')
    expect(linesOfEvent('nope')).toEqual([])
  })
})

describe('markdown', () => {
  it('parses headings, lists and code, and never injects HTML', () => {
    const blocks = parseMarkdown('# Titre\n\n- a\n- b\n\n```\ncode\n```\n')
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'list', 'code'])
    const { container } = render(<Markdown source={'<img src=x onerror=alert(1)> **gras** [lien](https://example.com)'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('strong')).toHaveTextContent('gras')
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
  })
})

describe('IssuePage', () => {
  it('shows the header, the timeline by phase and the cost', async () => {
    mockApi({ ...ROUTES, 'GET /tickets/GH-12/cost': { body: { costUsd: 2.5 } }, 'GET /tickets/GH-12/pr': { body: { number: 40, state: 'open', additions: 10, deletions: 2 } } })
    render12()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Dash en l’air')
    expect(await screen.findByText(/PR #40/)).toBeInTheDocument()
    expect(await screen.findByText(/2,50/)).toBeInTheDocument()
    const phase = screen.getByRole('region', { name: 'Phase realisation' })
    expect(within(phase).getByText('implement')).toBeInTheDocument()
    expect(within(phase).getByText('itération 2')).toBeInTheDocument()
  })

  it('approves the gate at once and asks before rejecting', async () => {
    const calls = mockApi({
      ...ROUTES,
      'POST /flows/GH-12/steps/merge_gate/approve': { body: { ok: true } },
      'POST /flows/GH-12/steps/merge_gate/reject': { body: { ok: true } },
    })
    render12()
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/flows/GH-12/steps/merge_gate/approve')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))
    expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/flows/GH-12/steps/merge_gate/reject')).toBe(true))
  })

  it('lists proofs lazily from the run files route', async () => {
    mockApi({
      ...ROUTES,
      'GET /runs/run-a/files': { body: [{ path: 'shots/dash 1.png', size: 2048, kind: 'png', stage: 'test' }, { path: 'plan.md', size: 10, kind: 'md' }] },
      'GET /runs/run-b/files': { body: [{ path: 'demo.gif', size: 4096, kind: 'gif' }] },
    })
    render12()
    fireEvent.click(await screen.findByRole('tab', { name: 'Preuves' }))
    const images = await screen.findAllByRole('img')
    expect(images).toHaveLength(2)
    for (const image of images) expect(image).toHaveAttribute('loading', 'lazy')
    expect(images[0]).toHaveAttribute('src', '/api/runs/run-a/files/shots/dash%201.png')
  })

  it('says "bientôt disponible" when the files route is missing', async () => {
    mockApi(ROUTES)
    render12()
    fireEvent.click(await screen.findByRole('tab', { name: 'Preuves' }))
    expect(await screen.findByTestId('soon')).toHaveTextContent('bientôt disponible')
  })

  it('renders a Markdown artefact on demand', async () => {
    mockApi({
      ...ROUTES,
      'GET /runs/run-a/files': { body: [{ path: 'plan.md', size: 30, kind: 'md', stage: 'plan' }] },
      'GET /runs/run-b/files': { body: [] },
      'GET /runs/run-a/files/plan.md': { text: '# Plan\n\n- étape **un**' },
    })
    render12()
    fireEvent.click(await screen.findByRole('button', { name: /plan\.md/ }))
    expect(await screen.findByText('étape')).toBeInTheDocument()
    expect(screen.getByText('un').tagName).toBe('STRONG')
  })
})
