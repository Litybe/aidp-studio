import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UsageBucket } from '../../api/types/budget'
import { mockFetch } from '../../test/render'
import { renderPage } from '../../test/harness'
import BudgetPage from './BudgetPage'
import { bucketBars, dayBars, fromMillions, sinceDate, toMillions, topBuckets } from './queries'

const bucket = (key: string, totalTokens: number): UsageBucket => ({
  key,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreateTokens: 0,
  totalTokens,
  estimatedCostUsd: 0,
  sessions: 2,
  turns: 4,
})
const usage = (groupBy: string, buckets: ReturnType<typeof bucket>[]) => ({ groupBy, totals: bucket('total', 0), buckets })

const BUDGET = {
  verdict: {
    verdict: 'conservative',
    maxLaunches: 1,
    why: 'fenêtre 5 h à 70 %',
    utilization5h: 0.7,
    utilization7d: 0.2,
    limit5h: 0.8,
    limit7d: 0.9,
    reserve5h: 0,
    reserve7d: 0,
    unreflected: 0,
    resetsAt5h: null,
    waitWindow: null,
    observedAt: null,
  },
  live: {
    status: 'allowed',
    isUsingOverage: false,
    fiveHour: { utilization: 0.7, resetsAt: new Date(Date.now() + 2 * 3600_000).toISOString() },
    sevenDay: { utilization: 0.2, resetsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() },
    observedAt: '2026-11-06T10:00:00Z',
  },
  reserves: { fiveHour: 0, sevenDay: 0, learned: false },
  unreflected: 0,
  stats: null,
}

const SETTINGS = {
  budget: {
    max_utilization_5h: 0.8,
    max_utilization_7d: 0.9,
    reserve_per_run_5h: 0.1,
    reserve_per_run_7d: 0.02,
    unknown_policy: 'conservative',
    learn: true,
    per_ticket: { code: 3_000_000, art: 1_500_000, map: 2_000_000, doc: 500_000, default: 2_000_000 },
    pixellab: { min_reserve: 0, per_ticket: 10 },
  },
  dispatcher: {
    slots: 5,
    stop_at_7d_percent: 90,
    night: { enabled: false, start: '22:00', end: '07:00', heavy_after_reset: true, heavy_window_minutes: 30 },
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('Budget helpers', () => {
  it('converts tokens and millions', () => {
    expect(toMillions(3_000_000)).toBe('3')
    expect(fromMillions('1,5')).toBe(1_500_000)
    expect(fromMillions('')).toBeUndefined()
  })

  it('builds bars and the top of the most expensive buckets', () => {
    const buckets = [bucket('GH-1', 10), bucket('GH-2', 50), bucket('GH-3', 30)]
    expect(topBuckets(buckets, 2).map((b) => b.key)).toEqual(['GH-2', 'GH-3'])
    expect(bucketBars(buckets, 2)).toEqual([
      { label: 'GH-1', value: 10 },
      { label: 'GH-2', value: 50 },
    ])
    expect(dayBars(buckets, 2).map((b) => b.label)).toEqual(['GH-2', 'GH-3'])
    expect(sinceDate(30, Date.parse('2026-11-06T12:00:00Z'))).toBe('2026-10-07')
  })
})

describe('Budget page', () => {
  it('shows gauges with countdown, verdict, bars, top issues and « bientôt disponible » for 404s', async () => {
    mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /usage': (call) =>
        call.path.includes('groupBy=day')
          ? { body: usage('day', [bucket('2026-11-05', 1000), bucket('2026-11-06', 4000)]) }
          : call.path.includes('groupBy=ticket')
            ? { body: usage('ticket', [{ ...bucket('GH-214', 9000), runs: ['20261110-140813-4648'] }, bucket('GH-3', 100), bucket('unknown', 5)]) }
            : { status: 400, body: { error: 'groupBy inconnu' } },
    })
    renderPage(BudgetPage)
    expect(await screen.findByTestId('verdict')).toHaveTextContent('prudent')
    expect(screen.getByTestId('gauge-5h')).toHaveTextContent('70%')
    expect(screen.getByTestId('gauge-5h')).toHaveTextContent('reset')
    const bars = await screen.findAllByTestId('bar')
    expect(bars.length).toBeGreaterThanOrEqual(2)
    const top = await screen.findByRole('region', { name: 'Issues les plus chères' })
    const link = await within(top).findByRole('link', { name: '#214' })
    expect(link).toHaveAttribute('href', '/issue/GH-214')
    expect(link.closest('td')).toHaveAttribute('title', expect.stringContaining('20261110-140813-4648'))
    expect(within(top).queryByText('20261110-140813-4648')).toBeNull()
    expect(within(top).getByText('inconnue')).toBeInTheDocument()
    expect((await screen.findAllByTestId('coming-soon')).length).toBeGreaterThanOrEqual(3)
  })

  it('saves the settings in the daemon shape and shows the daemon errors field by field on 400', async () => {
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: SETTINGS },
      'PUT /settings/budget': (call) => {
        const sent = call.body as { budget: { per_ticket: { art?: number } } }
        return sent.budget.per_ticket.art === 99_000_000
          ? {
              status: 400,
              body: {
                error: 'invalid settings',
                code: 'bad_request',
                errors: [
                  { path: 'budget.per_ticket.art', message: 'trop grand' },
                  { path: 'dispatcher.night.start', message: 'heure invalide' },
                ],
              },
            }
          : { body: { ...SETTINGS, reloadRequired: false, changed: true } }
      },
    })
    renderPage(BudgetPage)
    const art = await screen.findByLabelText('Plafond art')
    await userEvent.clear(art)
    await userEvent.type(art, '99')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('trop grand')).toBeInTheDocument()
    expect(screen.getByText('heure invalide')).toBeInTheDocument()
    await userEvent.clear(art)
    await userEvent.type(art, '1.5')
    await userEvent.click(screen.getByLabelText(/^Mode nuit/))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    const put = calls.filter((call) => call.method === 'PUT').at(-1)
    expect(put?.body).toEqual({
      budget: {
        per_ticket: { code: 3_000_000, art: 1_500_000, map: 2_000_000, doc: 500_000, default: 2_000_000 },
        pixellab: { min_reserve: 0, per_ticket: 10 },
      },
      dispatcher: {
        slots: 5,
        stop_at_7d_percent: 90,
        night: { ...SETTINGS.dispatcher.night, enabled: true },
      },
    })
  })

  it('clears the 7 d stop with null and says when a restart is needed', async () => {
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: SETTINGS },
      'PUT /settings/budget': { body: { ...SETTINGS, reloadRequired: true, changed: true } },
    })
    renderPage(BudgetPage)
    await userEvent.clear(await screen.findByLabelText('Seuil 7 j'))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/redémarrage du daemon requis/)).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toMatchObject({ dispatcher: { stop_at_7d_percent: null } })
  })

  it('refuses a text that is not a number without calling the daemon', async () => {
    const calls = mockFetch({ 'GET /dispatcher/budget': { body: BUDGET }, 'GET /settings/budget': { body: SETTINGS } })
    renderPage(BudgetPage)
    const slots = await screen.findByLabelText('Places de dev')
    await userEvent.clear(slots)
    await userEvent.type(slots, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('nombre attendu')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
  })

  it('edits the test places when the daemon sends them, read-only otherwise', async () => {
    const withTest = { ...SETTINGS, dispatcher: { ...SETTINGS.dispatcher, test_slots: 1 } }
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: withTest },
      'PUT /settings/budget': { body: { ...withTest, reloadRequired: false, changed: true } },
    })
    renderPage(BudgetPage)
    const field = await screen.findByLabelText('Places de test')
    expect(field).not.toHaveAttribute('readonly')
    expect(field).toHaveValue('1')
    await userEvent.clear(field)
    await userEvent.type(field, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByLabelText('Places de test')
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toMatchObject({ dispatcher: { test_slots: 2 } })
  })

  it('shows the test places read-only and never sends them when the daemon omits them', async () => {
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: SETTINGS },
      'PUT /settings/budget': { body: { ...SETTINGS, reloadRequired: false, changed: true } },
    })
    renderPage(BudgetPage)
    expect(await screen.findByLabelText('Places de test')).toHaveAttribute('readonly')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
    expect(JSON.stringify(calls.filter((call) => call.method === 'PUT').at(-1)?.body)).not.toContain('test_slots')
  })
})

describe('Pixellab card', () => {
  it('shows the generations left sent by the daemon', async () => {
    mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /pixellab/balance': { body: { balance: 1436.6, recordedAt: '2026-11-10T15:30:00Z', minReserve: 0 } },
    })
    renderPage(BudgetPage)
    expect(await screen.findByText(/1436\.6 générations restantes/)).toBeInTheDocument()
  })

  it('edits the bug places when the daemon sends them, read-only otherwise', async () => {
    const withBug = { ...SETTINGS, dispatcher: { ...SETTINGS.dispatcher, bug_slots: 1 } }
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: withBug },
      'PUT /settings/budget': { body: { ...withBug, reloadRequired: false, changed: true } },
    })
    renderPage(BudgetPage)
    const field = await screen.findByLabelText('Places de bug')
    expect(field).not.toHaveAttribute('readonly')
    await userEvent.clear(field)
    await userEvent.type(field, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByLabelText('Places de bug')
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toMatchObject({ dispatcher: { bug_slots: 2 } })
  })

  it('shows the bug places read-only and never sends them when the daemon omits them', async () => {
    const calls = mockFetch({
      'GET /dispatcher/budget': { body: BUDGET },
      'GET /settings/budget': { body: SETTINGS },
      'PUT /settings/budget': { body: { ...SETTINGS, reloadRequired: false, changed: true } },
    })
    renderPage(BudgetPage)
    expect(await screen.findByLabelText('Places de bug')).toHaveAttribute('readonly')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
    expect(JSON.stringify(calls.filter((call) => call.method === 'PUT').at(-1)?.body)).not.toContain('bug_slots')
  })
})
