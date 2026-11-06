import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, renderPage } from '../../test/render'
import { cleanModels } from './ModelsForm'
import SettingsPage from './SettingsPage'

const ROUTING = {
  defaults: { track: 'main' },
  rules: [{ match: { label: 'aidp:art' }, service: 'art' }],
  repos: { pixelhood: { flow: 'game-code', track: 'main' } },
  extra: 1,
}

afterEach(() => vi.unstubAllGlobals())

describe('Réglages', () => {
  it('drops empty model choices', () => {
    expect(cleanModels({ code: { plan: 'opus', test: '' }, art: { brief: '' } })).toEqual({ code: { plan: 'opus' } })
  })

  it('shows « bientôt disponible » on 404 without breaking the page', async () => {
    mockFetch({})
    renderPage(<SettingsPage />)
    await waitFor(() => expect(screen.getAllByTestId('coming-soon').length).toBeGreaterThanOrEqual(5))
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument()
  })

  it('shows field-by-field 400 errors of the routing and keeps unknown keys on save', async () => {
    const calls = mockFetch({
      'GET /settings/routing': { body: ROUTING },
      'PUT /settings/routing': (call) => {
        const sent = call.body as { rules: { service: string }[] }
        return sent.rules[0]?.service === 'bad'
          ? { status: 400, body: { error: 'routage invalide', errors: [{ path: 'rules[0].service', message: 'service inconnu' }] } }
          : { body: sent }
      },
      'GET /dispatcher': { body: { slots: { used: 2, max: 5 } } },
      'GET /catalog/flows': { body: [{ id: 'game-code', name: 'Game code' }] },
      'GET /catalog/templates': { body: [{ id: 'dev-unity', stageCount: 6 }] },
    })
    renderPage(<SettingsPage />)
    const service = await screen.findByLabelText('Service 1')
    await userEvent.clear(service)
    await userEvent.type(service, 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le routage' }))
    expect(await screen.findByText('service inconnu')).toBeInTheDocument()
    await userEvent.clear(service)
    await userEvent.type(service, 'code')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le routage' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    const put = calls.filter((call) => call.method === 'PUT').at(-1)
    expect(put?.body).toMatchObject({ extra: 1, rules: [{ match: { label: 'aidp:art' }, service: 'code' }], repos: { pixelhood: { flow: 'game-code' } } })
    expect(await screen.findByText('2 utilisés sur 5')).toBeInTheDocument()
    expect(await screen.findByText('Game code')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Catalogues' })).getByText(/dev-unity/)).toBeInTheDocument()
  })

  it('saves the model policy', async () => {
    const calls = mockFetch({
      'GET /settings/models': { body: { code: { review: 'sonnet' } } },
      'PUT /settings/models': (call) => ({ body: call.body }),
      'GET /usage': { body: { groupBy: 'stage', totals: {}, buckets: [{ key: 'review', totalTokens: 3000, sessions: 3 }] } },
    })
    renderPage(<SettingsPage />)
    const select = await screen.findByLabelText('art report')
    await userEvent.selectOptions(select, 'haiku')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modèles' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toEqual({ code: { review: 'sonnet' }, art: { report: 'haiku' } })
  })
})
