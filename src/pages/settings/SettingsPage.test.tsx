import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, renderPage } from '../../test/render'
import { cleanModels } from './ModelsForm'
import { toRule } from './RoutingForm'
import SettingsPage from './SettingsPage'

const ROUTING = {
  defaults: { track: 'standard' },
  rules: [
    { match: { labels: ['aidp:art', 'pixel:*'], keywords: ['sprite'], component: 'ui' }, service: 'pixelhood-art' },
    { match: { label: 'bug' }, service: 'pixelhood-code' },
  ],
  repos: {
    'pixelhood-art': { route: 'art', flow: 'game-art' },
    'pixelhood-code': { route: 'code', flow: 'game-code', track: 'bug' },
  },
}

const MODELS = {
  models: { code: { review: 'sonnet' }, doc: { custom_stage: 'haiku' } },
  routes: ['code', 'art', 'map', 'doc'],
  stages: ['prepare', 'plan', 'review', 'report'],
  tiers: ['haiku', 'sonnet', 'opus', 'fable'],
}

const SAVED = { reloadRequired: false, changed: true }

afterEach(() => vi.unstubAllGlobals())

describe('Réglages', () => {
  it('drops empty model choices', () => {
    expect(cleanModels({ code: { plan: 'opus', test: '' }, art: { brief: '' } })).toEqual({ code: { plan: 'opus' } })
  })

  it('writes the list criteria only when they hold something and keeps the others', () => {
    const draft = { labels: ' a, b ,', keywords: '', service: ' svc ', others: { component: 'ui' } }
    expect(toRule(draft)).toEqual({ match: { component: 'ui', labels: ['a', 'b'] }, service: 'svc' })
  })

  it('shows « bientôt disponible » on 404 without breaking the page', async () => {
    mockFetch({})
    renderPage(<SettingsPage />)
    await waitFor(() => expect(screen.getAllByTestId('coming-soon').length).toBeGreaterThanOrEqual(5))
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument()
  })

  it('shows field-by-field 400 errors of the routing and sends the daemon shape on save', async () => {
    const calls = mockFetch({
      'GET /settings/routing': { body: ROUTING },
      'PUT /settings/routing': (call) => {
        const sent = call.body as { rules: { service: string }[] }
        return sent.rules[1]?.service === 'pixelhood-art'
          ? {
              status: 400,
              body: { error: 'invalid settings', code: 'bad_request', errors: [{ path: 'rules[1].service', message: 'cible inconnue' }, { path: 'repos.pixelhood-art.flow', message: 'flow vide' }] },
            }
          : { body: { ...sent, ...SAVED } }
      },
      'GET /dispatcher': { body: { slots: { used: 2, max: 5 } } },
      'GET /catalog/flows': { body: [{ id: 'game-code', name: 'Game code' }, { id: 'game-map', name: 'Game map' }] },
      'GET /catalog/templates': { body: [{ id: 'dev-unity', stageCount: 6 }] },
    })
    renderPage(<SettingsPage />)
    expect(await screen.findByLabelText('Labels 1')).toHaveValue('aidp:art, pixel:*')
    expect(screen.getByText(/component: ui/)).toBeInTheDocument()
    expect(screen.getByLabelText('Labels 2')).toHaveValue('bug')
    const service = screen.getByLabelText('Service 2')
    await userEvent.selectOptions(service, 'pixelhood-art')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le routage' }))
    expect(await screen.findByText('cible inconnue')).toBeInTheDocument()
    expect(screen.getByText('flow vide')).toBeInTheDocument()
    await userEvent.selectOptions(service, 'pixelhood-code')
    await userEvent.selectOptions(screen.getByLabelText('pixelhood-code track'), 'quick')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le routage' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    const put = calls.filter((call) => call.method === 'PUT').at(-1)
    expect(put?.body).toEqual({
      defaults: { track: 'standard' },
      rules: [
        { match: { component: 'ui', labels: ['aidp:art', 'pixel:*'], keywords: ['sprite'] }, service: 'pixelhood-art' },
        { match: { labels: ['bug'] }, service: 'pixelhood-code' },
      ],
      repos: {
        'pixelhood-art': { route: 'art', flow: 'game-art' },
        'pixelhood-code': { route: 'code', flow: 'game-code', track: 'quick' },
      },
    })
    expect(await screen.findByText('2 utilisés sur 5')).toBeInTheDocument()
    expect(await screen.findByText('Game code')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Catalogues' })).getByText(/dev-unity/)).toBeInTheDocument()
  })

  it('adds all known flows as targets with their route rule', async () => {
    const calls = mockFetch({
      'GET /settings/routing': { body: { defaults: {}, rules: [], repos: {} } },
      'PUT /settings/routing': (call) => ({ body: { ...(call.body as object), ...SAVED } }),
      'GET /catalog/flows': { body: [{ id: 'game-code' }, { id: 'game-map' }, { id: 'misc' }] },
      'GET /catalog/templates': { body: [{ id: 'dev-unity' }] },
    })
    renderPage(<SettingsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Ajouter tous les flows connus \(3\)/ }))
    await userEvent.selectOptions(screen.getByLabelText('game-code template'), 'dev-unity')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le routage' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toEqual({
      defaults: {},
      rules: [
        { match: { labels: ['aidp:code'] }, service: 'game-code' },
        { match: { labels: ['aidp:map'] }, service: 'game-map' },
      ],
      repos: { 'game-code': { flow: 'game-code', route: 'code', template: 'dev-unity' }, 'game-map': { flow: 'game-map', route: 'map' }, misc: { flow: 'misc' } },
    })
  })

  it('applies raw JSON to the form', async () => {
    mockFetch({ 'GET /settings/routing': { body: ROUTING } })
    renderPage(<SettingsPage />)
    await screen.findByLabelText('Labels 1')
    await userEvent.click(screen.getByText('Édition avancée (JSON brut)'))
    const area = screen.getByLabelText('Routage JSON')
    expect((area as HTMLTextAreaElement).value).toContain('pixelhood-art')
    await userEvent.clear(area)
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer au formulaire' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON invalide')
  })

  it('saves the model policy under the models key, with the stages and tiers of the daemon', async () => {
    const calls = mockFetch({
      'GET /settings/models': { body: MODELS },
      'PUT /settings/models': (call) => ({ body: { ...MODELS, models: (call.body as { models: object }).models, ...SAVED } }),
      'GET /usage': { body: { groupBy: 'stage', totals: {}, buckets: [{ key: 'review', totalTokens: 3000, sessions: 3 }] } },
    })
    renderPage(<SettingsPage />)
    const select = await screen.findByLabelText('art report')
    expect(screen.getByLabelText('doc custom_stage')).toHaveValue('haiku')
    expect(within(select).getByRole('option', { name: 'fable' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'haiku')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modèles' }))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toEqual({
      models: { code: { review: 'sonnet' }, doc: { custom_stage: 'haiku' }, art: { report: 'haiku' } },
    })
  })

  it('shows the daemon error of one model cell', async () => {
    mockFetch({
      'GET /settings/models': { body: MODELS },
      'PUT /settings/models': { status: 400, body: { error: 'invalid settings', errors: [{ path: 'models.code.review', message: 'palier inconnu' }] } },
    })
    renderPage(<SettingsPage />)
    await screen.findByLabelText('code review')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modèles' }))
    expect(await screen.findByText('palier inconnu')).toBeInTheDocument()
  })
})
