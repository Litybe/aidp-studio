import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Ticket } from '../../api/types'
import { mockFetch, renderPage } from '../../test/render'
import { TestQueueCard } from './TestQueueCard'
import { testQueue } from './testQueue'

const t = (over: Partial<Ticket>): Ticket => ({ key: 'GH-1', summary: 'x', status: 'in-progress', ...over })
const TICKETS = [
  t({ key: 'GH-7', summary: 'Dash', labels: ['aidp:to-test'], branch: 'aidp/gh-7' }),
  t({ key: 'GH-5', summary: 'Saut', phase: 'testing', branch: 'aidp/gh-5', flowSummary: { flowKey: 'f', status: 'running', phase: 'unity-test', stepId: 'unity-test', iteration: 1, startedAt: null } }),
  t({ key: 'GH-9', summary: 'Mur', phase: 'to-test' }),
  t({ key: 'GH-2', summary: 'Autre', labels: ['aidp:review'] }),
]

describe('testQueue', () => {
  it('splits the current issue from the waiting ones and keeps the daemon order', () => {
    const { current, waiting } = testQueue(TICKETS)
    expect(current?.key).toBe('GH-5')
    expect(waiting.map((ticket) => ticket.key)).toEqual(['GH-7', 'GH-9'])
  })
})

describe('TestQueueCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows nothing without any test issue', async () => {
    mockFetch({ 'GET /tickets': { body: [TICKETS[3]] }, 'GET /queue': { body: [] } })
    const { container } = renderPage(<TestQueueCard />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the current issue then the queue, and promotes the second one', async () => {
    const calls = mockFetch({
      'GET /tickets': { body: TICKETS },
      'GET /queue': { body: [{ id: 'q9', projectId: 'p', target: 'GH-9', priority: 1, status: 'queued' }] },
      'POST /queue/q9/promote': { body: {} },
    })
    renderPage(<TestQueueCard />)
    const current = await screen.findByTestId('test-current')
    expect(current).toHaveTextContent('#5')
    expect(current).toHaveTextContent('aidp/gh-5')
    expect(current).toHaveTextContent('étape unity-test')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('#7')
    expect(items[1]).toHaveTextContent('#9')
    expect(screen.getAllByRole('button', { name: 'Monter en priorité' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Monter en priorité' }))
    await screen.findByRole('button', { name: 'Monter en priorité' })
    expect(calls.some((call) => call.method === 'POST' && call.path.includes('/queue/q9/promote'))).toBe(true)
  })
})
