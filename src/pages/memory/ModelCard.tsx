import { useState, type ReactNode } from 'react'
import type { MemoryModel, MemoryModelState } from '../../api/types/memoryModel'
import { Async } from '../../components/Async'
import { BUTTON, BUTTON_PRIMARY, type Tone } from '../../components/ui/classes'
import { Card } from '../../components/ui/Card'
import { Pill } from '../../components/ui/Pill'
import { formatDateTime } from '../../lib/format'
import { showToast } from '../../lib/toast'
import {
  embeddedPercent,
  formatRam,
  installCommand,
  MODEL_CARD_ID,
  STATE_LABEL,
  useEmbedPending,
  useMemoryModel,
  useSetAutostart,
  useStartModel,
  useStopModel,
} from './modelQueries'

const STATE_TONE: Record<MemoryModelState, Tone> = { stopped: 'muted', loading: 'warn', running: 'ok', error: 'danger' }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink-soft">{children}</dd>
    </div>
  )
}

function InstallHelp({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const command = installCommand(path)
  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      showToast('Copie impossible : sélectionne la commande à la main.')
    }
  }
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-ink-soft">Le modèle n'est pas installé. Tant qu'il manque, la recherche se rabat sur BM25 et le glossaire.</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line bg-canvas px-2 py-1.5 font-mono text-ink">{command}</code>
        <button type="button" className={BUTTON} onClick={() => void copy()}>
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  )
}

function Controls({ model }: { model: MemoryModel }) {
  const start = useStartModel()
  const stop = useStopModel()
  const autostart = useSetAutostart()
  const embed = useEmbedPending()
  const loading = model.state === 'loading' || start.isPending
  const running = model.state === 'running'
  const pending = model.chunks.total - model.chunks.embedded
  const failure = [start, stop, autostart, embed].find((mutation) => mutation.isError)?.error
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON_PRIMARY} disabled={running || loading || !model.installed} onClick={() => start.mutate()}>
          Démarrer
        </button>
        <button type="button" className={BUTTON} disabled={model.state === 'stopped' || stop.isPending} onClick={() => stop.mutate()}>
          Arrêter
        </button>
        {running && pending > 0 ? (
          <button type="button" className={BUTTON} disabled={embed.isPending} onClick={() => embed.mutate()}>
            Vectoriser les chunks en attente
          </button>
        ) : null}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={model.autostart} disabled={autostart.isPending} onChange={(event) => autostart.mutate(event.target.checked)} />
          Démarrer avec le daemon
        </label>
      </div>
      {embed.isSuccess ? <p className="text-xs text-ink-muted">Vectorisation lancée.</p> : null}
      {failure ? (
        <p role="alert" className="text-xs text-rose-400">
          {failure.message}
        </p>
      ) : null}
    </div>
  )
}

function ModelBody({ model }: { model: MemoryModel }) {
  const { chunks } = model
  const percent = embeddedPercent(chunks.embedded, chunks.total)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink">{model.model}</span>
        <Pill tone={STATE_TONE[model.state]} dot>
          {STATE_LABEL[model.state]}
        </Pill>
      </div>
      {model.installed ? null : <InstallHelp path={model.path} />}
      <dl className="flex flex-col gap-1 text-xs">
        {model.state === 'running' && model.ramBytes !== null ? <Row label="Mémoire vive">{formatRam(model.ramBytes)}</Row> : null}
        {model.dim !== null ? <Row label="Dimension">{model.dim}</Row> : null}
        <Row label="Chunks vectorisés">
          <span className="tabular-nums">
            {chunks.embedded}/{chunks.total}
          </span>
          {chunks.stale > 0 ? <span className="ml-2 text-amber-300">{chunks.stale} périmés</span> : null}
          <div
            role="progressbar"
            aria-label="Chunks vectorisés"
            aria-valuemin={0}
            aria-valuemax={chunks.total}
            aria-valuenow={chunks.embedded}
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-raised"
          >
            <div className="h-full bg-accent-strong" style={{ width: `${percent}%` }} />
          </div>
        </Row>
        <Row label="Chemin">
          <span className="font-mono">{model.path}</span>
        </Row>
        {model.loadedAt ? <Row label="Chargé le">{formatDateTime(model.loadedAt)}</Row> : null}
      </dl>
      {model.error ? (
        <p role="alert" className="text-xs text-rose-400">
          {model.error}
        </p>
      ) : null}
      <Controls model={model} />
    </div>
  )
}

/** « Modèle d'embeddings » of the Mémoire page; a daemon without the route shows « bientôt disponible ». */
export function ModelCard() {
  const query = useMemoryModel()
  return (
    <div id={MODEL_CARD_ID}>
      <Card title="Modèle d'embeddings">
        <Async query={query} what="Modèle d'embeddings">
          {(model) => <ModelBody model={model} />}
        </Async>
      </Card>
    </div>
  )
}
