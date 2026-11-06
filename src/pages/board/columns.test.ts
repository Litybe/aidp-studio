import type { Ticket } from '../../api/types'
import { buildBoard, columnOf, routeOf, ticketNumber } from './columns'

const t = (over: Partial<Ticket>): Ticket => ({ key: 'GH-1', summary: 'x', status: 'todo', ...over })

describe('columnOf', () => {
  it.each([
    [{ status: 'todo', labels: ['aidp:triage'] }, 'triage'],
    [{ status: 'blocked: needs-refine' }, 'triage'],
    [{ status: 'blocked: ci-failed' }, 'blocked'],
    [{ status: 'todo', labels: ['aidp:blocked'] }, 'blocked'],
    [{ status: 'todo', labels: ['aidp:ready'] }, 'ready'],
    [{ status: 'todo' }, 'ready'],
    [{ status: 'queued', labels: ['aidp:queued'] }, 'queued'],
    [{ status: 'in-progress', labels: ['aidp:in-progress'] }, 'realisation'],
    [{ status: 'in-progress', labels: ['aidp:review'] }, 'review'],
    [{ status: 'in-progress', labels: ['aidp:fixing'] }, 'review'],
    [{ status: 'in-progress', labels: ['aidp:testing'] }, 'test'],
    [{ status: 'in-review', labels: ['aidp:awaiting-merge'] }, 'merge'],
    [{ status: 'in-review' }, 'merge'],
    [{ status: 'done', labels: ['aidp:done'] }, 'done'],
    [{ status: 'cancelled' }, null],
    [{ status: 'todo', labels: ['aidp:skip'] }, null],
  ] as [Partial<Ticket>, string | null][])('%j goes to %s', (over, column) => {
    expect(columnOf(t(over))).toBe(column)
  })

  it('reads the live phase of the flow before the bare status', () => {
    const flow = (phase: string, status = 'running') => ({
      flowKey: 'GH-1',
      status,
      phase,
      stepId: null,
      iteration: 1,
      startedAt: null,
    })
    expect(columnOf(t({ status: 'in-progress', flowSummary: flow('unity-test') }))).toBe('test')
    expect(columnOf(t({ status: 'in-progress', flowSummary: flow('review') }))).toBe('review')
    expect(columnOf(t({ status: 'in-progress', flowSummary: flow('implement') }))).toBe('realisation')
    expect(columnOf(t({ status: 'in-progress', flowSummary: flow('implement', 'escalated') }))).toBe('blocked')
  })

  it('puts a flow waiting on the merge approval in the merge column', () => {
    const flowSummary = { flowKey: 'GH-1', status: 'waiting_human', phase: null, stepId: 'merge_approval', iteration: 1, startedAt: null }
    expect(columnOf(t({ status: 'in-progress', flowSummary }))).toBe('merge')
  })
})

describe('routeOf and ticketNumber', () => {
  it('prefers the daemon route, else the first matching label, else code', () => {
    expect(routeOf(t({ route: 'map', labels: ['pixelart'] }))).toBe('map')
    expect(routeOf(t({ labels: ['bug', 'pixel:ui'] }))).toBe('art')
    expect(routeOf(t({ labels: ['ldtk'] }))).toBe('map')
    expect(routeOf(t({ labels: ['bible'] }))).toBe('doc')
    expect(routeOf(t({ labels: ['feature'] }))).toBe('code')
  })

  it('numbers by the GitHub number, else the key digits', () => {
    expect(ticketNumber(t({ githubNumber: 214 }))).toBe('#214')
    expect(ticketNumber(t({ key: 'GH-37' }))).toBe('#37')
  })
})

describe('buildBoard', () => {
  const tickets = [
    t({ key: 'GH-1', status: 'todo', route: 'code', milestone: { title: 'M1', dueOn: null }, labels: ['aidp:ready', 'feature'] }),
    t({ key: 'GH-2', status: 'todo', route: 'art', milestone: { title: 'M2', dueOn: null }, labels: ['aidp:ready'] }),
    t({ key: 'GH-3', status: 'done' }),
    t({ key: 'GH-4', status: 'cancelled' }),
  ]

  it('groups by column and hides cancelled tickets', () => {
    const board = buildBoard(tickets)
    expect(board.ready.map((x) => x.key)).toEqual(['GH-1', 'GH-2'])
    expect(board.done.map((x) => x.key)).toEqual(['GH-3'])
    expect(Object.values(board).flat()).toHaveLength(3)
  })

  it('filters by route, milestone and label', () => {
    expect(buildBoard(tickets, { route: 'art', milestone: '', label: '' }).ready.map((x) => x.key)).toEqual(['GH-2'])
    expect(buildBoard(tickets, { route: '', milestone: 'M1', label: '' }).ready.map((x) => x.key)).toEqual(['GH-1'])
    expect(buildBoard(tickets, { route: '', milestone: '', label: 'feature' }).ready.map((x) => x.key)).toEqual(['GH-1'])
  })
})
