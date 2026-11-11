import type { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { f2Keys } from '../../api/f2Keys'
import { isMemoryModel, type MemoryModel } from '../../api/types/memoryModel'
import { ModelIndicator } from '../../components/ModelIndicator'
import { keysForEvent } from '../../realtime/invalidation'
import { mockFetch, renderPage } from '../../test/render'
import { renderPage as renderRouted } from '../../test/harness'
import { ModelCard } from './ModelCard'
import { embeddedPercent, formatRam, installCommand } from './modelQueries'

const GIB = 1024 * 1024 * 1024
const MODEL_PATH = 'D:\\AIDP\\models\\potion-multilingual-128M'

const model = (patch: Partial<MemoryModel> = {}): MemoryModel => ({
  model: 'potion-multilingual-128M',
  installed: true,
  state: 'stopped',
  autostart: false,
  dim: null,
  ramBytes: null,
  loadedAt: null,
  error: null,
  chunks: { total: 100, embedded: 40, stale: 3 },
  path: MODEL_PATH,
  ...patch,
})

const running = (patch: Partial<MemoryModel> = {}) => model({ state: 'running', dim: 256, ramBytes: 0.5 * GIB, loadedAt: '2026-11-11T10:00:00Z', ...patch })

afterEach(() => vi.unstubAllGlobals())

describe('helpers', () => {
  it('formats RAM, progress and the install command', () => {
    expect(formatRam(512 * 1024 * 1024)).toBe('512 Mo')
    expect(formatRam(1.5 * GIB)).toMatch(/^1,5\sGo$/)
    expect(embeddedPercent(40, 100)).toBe(40)
    expect(embeddedPercent(0, 0)).toBe(0)
    expect(installCommand('X:\\m')).toBe('git clone https://huggingface.co/minishlab/potion-multilingual-128M X:\\m')
  })

  it('does not refetch the memory family on memory.model, and validates the payload', () => {
    expect(keysForEvent({ id: 1, type: 'memory.model', ts: 0, data: model() })).toEqual([])
    expect(keysForEvent({ id: 2, type: 'memory.proposed', ts: 0, data: {} })).toEqual([f2Keys.memory])
    expect(isMemoryModel(model())).toBe(true)
    expect(isMemoryModel({ state: 'nope' })).toBe(false)
  })
})

describe('Modèle d\'embeddings', () => {
  it('shows a stopped model: no RAM, Démarrer enabled, Arrêter disabled, progress and stale', async () => {
    mockFetch({ 'GET /memory/model': { body: model() } })
    renderPage(<ModelCard />)
    expect(await screen.findByText('Arrêté')).toBeInTheDocument()
    expect(screen.getByText('40/100')).toBeInTheDocument()
    expect(screen.getByText('3 périmés')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Chunks vectorisés' })).toHaveAttribute('aria-valuenow', '40')
    expect(screen.queryByText('Mémoire vive')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Vectoriser/ })).not.toBeInTheDocument()
    expect(screen.getByText(MODEL_PATH)).toBeInTheDocument()
  })

  it('shows a running model with RAM and dimension, and stops it', async () => {
    const calls = mockFetch({
      'GET /memory/model': { body: running() },
      'POST /memory/model/stop': { body: model() },
    })
    renderPage(<ModelCard />)
    expect(await screen.findByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('512 Mo')).toBeInTheDocument()
    expect(screen.getByText('256')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Arrêter' }))
    expect(await screen.findByText('Arrêté')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST' && call.path === '/memory/model/stop')).toBe(true)
  })

  it('starts optimistically: the cache says loading before the daemon answers', async () => {
    let stateAtRequest: string | undefined
    const holder: { client?: QueryClient } = {}
    mockFetch({
      'GET /memory/model': { body: model() },
      'POST /memory/model/start': () => {
        stateAtRequest = holder.client?.getQueryData<MemoryModel>(f2Keys.memoryModel)?.state
        return { status: 202, body: model({ state: 'loading' }) }
      },
    })
    holder.client = renderPage(<ModelCard />).queryClient
    await userEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByText('Chargement…')).toBeInTheDocument()
    expect(stateAtRequest).toBe('loading')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeDisabled()
  })

  it('reports model_missing on start and rolls the state back', async () => {
    mockFetch({
      'GET /memory/model': { body: model() },
      'POST /memory/model/start': { status: 409, body: { error: 'modèle absent', code: 'model_missing' } },
    })
    renderPage(<ModelCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('modèle absent')
    expect(screen.getByText('Arrêté')).toBeInTheDocument()
  })

  it('shows the error state with its message', async () => {
    mockFetch({ 'GET /memory/model': { body: model({ state: 'error', error: 'safetensors illisible' }) } })
    renderPage(<ModelCard />)
    expect(await screen.findByText('Erreur')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('safetensors illisible')
  })

  it('embeds pending chunks only when running with chunks left', async () => {
    const calls = mockFetch({
      'GET /memory/model': { body: running() },
      'POST /memory/model/embed-pending': { status: 202, body: { queued: true } },
    })
    renderPage(<ModelCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Vectoriser les chunks en attente' }))
    expect(await screen.findByText('Vectorisation lancée.')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/memory/model/embed-pending')).toBe(true)
  })

  it('hides the embed button when everything is embedded', async () => {
    mockFetch({ 'GET /memory/model': { body: running({ chunks: { total: 10, embedded: 10, stale: 0 } }) } })
    renderPage(<ModelCard />)
    await screen.findByText('Actif')
    expect(screen.queryByRole('button', { name: /Vectoriser/ })).not.toBeInTheDocument()
  })

  it('toggles autostart with PATCH', async () => {
    const calls = mockFetch({
      'GET /memory/model': { body: model() },
      'PATCH /memory/model': { body: model({ autostart: true }) },
    })
    renderPage(<ModelCard />)
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Démarrer avec le daemon' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Démarrer avec le daemon' })).toBeChecked())
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ autostart: true })
  })

  it('explains the install and copies the command when the model is missing', async () => {
    mockFetch({ 'GET /memory/model': { body: model({ installed: false }) } })
    const writeText = vi.fn().mockResolvedValue(undefined)
    renderPage(<ModelCard />)
    const command = await screen.findByText(installCommand(MODEL_PATH))
    expect(screen.getByText(/BM25 et le glossaire/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeDisabled()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await userEvent.click(screen.getByRole('button', { name: 'Copier' }))
    expect(writeText).toHaveBeenCalledWith(command.textContent)
    expect(await screen.findByRole('button', { name: 'Copié' })).toBeInTheDocument()
  })

  it('follows a memory.model event written into the cache, without polling', async () => {
    mockFetch({ 'GET /memory/model': { body: model() } })
    const { queryClient } = renderPage(<ModelCard />)
    await screen.findByText('Arrêté')
    act(() => queryClient.setQueryData(f2Keys.memoryModel, running({ chunks: { total: 100, embedded: 90, stale: 0 } })))
    expect(await screen.findByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('90/100')).toBeInTheDocument()
  })

  it('says « bientôt disponible » on a daemon without the route', async () => {
    mockFetch({})
    renderPage(<ModelCard />)
    expect(await screen.findByTestId('coming-soon')).toHaveTextContent('bientôt disponible')
  })
})

describe('ModelIndicator', () => {
  it('shows the live state and links to the card', async () => {
    mockFetch({ 'GET /memory/model': { body: running() } })
    const { queryClient } = renderRouted(ModelIndicator)
    const link = await screen.findByTestId('model-indicator')
    expect(link).toHaveTextContent('Embeddings : actif')
    expect(link).toHaveAttribute('href', '/memory#embeddings-model')
    act(() => queryClient.setQueryData(f2Keys.memoryModel, model()))
    expect(await screen.findByText('Embeddings : arrêté')).toBeInTheDocument()
  })

  it('renders nothing while the daemon has no model route', async () => {
    mockFetch({})
    const { container, queryClient } = renderRouted(ModelIndicator)
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(container).toBeEmptyDOMElement()
  })
})
