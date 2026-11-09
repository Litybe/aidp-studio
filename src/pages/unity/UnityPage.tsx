import { PageHeader } from '../../components/ui/PageHeader'
import { CARD, H2 } from '../../components/ui/classes'
import { memo, useState } from 'react'
import { Async } from '../../components/Async'
import { StatusDot } from '../../components/StatusDot'
import { formatDateTime, formatDurationMs } from '../../lib/format'
import type { CompileResult, UnityStatus } from '../../api/types/unity'
import { TestQueueCard } from './TestQueueCard'
import { ticketLabel, useReleaseLock, useUnityStatus } from './queries'


const EditorCard = memo(function EditorCard({ editor }: { editor: UnityStatus['editor'] }) {
  return (
    <section className={CARD} aria-label="Éditeur">
      <h2 className={H2}>Éditeur</h2>
      <p className="flex items-center gap-2">
        <StatusDot tone={editor.running ? 'ok' : 'muted'} />
        {editor.running ? 'ouvert' : 'fermé'}
        {editor.pid !== null && editor.running ? <span className="text-ink-muted">PID {editor.pid}</span> : null}
      </p>
      <p className="mt-1 break-all text-xs text-ink-muted">{editor.projectPath ?? 'projet inconnu'}</p>
    </section>
  )
})

function ReleaseButton() {
  const release = useReleaseLock()
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button type="button" className="rounded border border-line-strong px-2 py-1 text-xs hover:bg-raised" onClick={() => setConfirming(true)}>
        Libérer
      </button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-amber-300">Libérer le verrou ? L&apos;étape en cours perd l&apos;éditeur.</span>
      <button
        type="button"
        className="rounded bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        disabled={release.isPending}
        onClick={() => release.mutate(undefined, { onSettled: () => setConfirming(false) })}
      >
        Confirmer la libération
      </button>
      <button type="button" className="rounded border border-line-strong px-2 py-1 hover:bg-raised" onClick={() => setConfirming(false)}>
        Annuler
      </button>
      {release.isError ? (
        <span role="alert" className="text-rose-400">
          {release.error.message}
        </span>
      ) : null}
    </span>
  )
}

const LockCard = memo(function LockCard({ lock }: { lock: UnityStatus['lock'] }) {
  return (
    <section className={CARD} aria-label="Verrou unity-editor">
      <h2 className={H2}>Verrou unity-editor</h2>
      {lock.held ? (
        <div className="flex flex-col gap-2">
          {lock.holder ? (
            <dl className="grid grid-cols-[6rem_1fr] gap-y-0.5">
              <dt className="text-ink-muted">Détenteur</dt>
              <dd>
                {ticketLabel(lock.holder.ticketKey)} <span className="text-ink-faint">({lock.holder.flowKey})</span>
              </dd>
              <dt className="text-ink-muted">Étape</dt>
              <dd>{lock.holder.stepId}</dd>
              <dt className="text-ink-muted">Depuis</dt>
              <dd>{formatDateTime(lock.holder.since)}</dd>
            </dl>
          ) : (
            <p className="text-ink-soft">Verrou pris, détenteur inconnu.</p>
          )}
          <div>
            <ReleaseButton />
          </div>
        </div>
      ) : (
        <p className="text-ink-muted">Libre.</p>
      )}
    </section>
  )
})

const CompileCard = memo(function CompileCard({ compile }: { compile: CompileResult | null }) {
  return (
    <section className={CARD} aria-label="Dernière compile gate">
      <h2 className={H2}>Dernière compile gate</h2>
      {compile ? (
        <>
          <p className="flex items-center gap-2">
            <StatusDot tone={compile.ok ? 'ok' : 'danger'} />
            {compile.ok ? 'réussie' : `${compile.errors.length} erreur${compile.errors.length > 1 ? 's' : ''}`}
            <span className="text-xs text-ink-muted">
              {compile.warnings} avertissement{compile.warnings > 1 ? 's' : ''} · {formatDurationMs(compile.durationMs)} ·{' '}
              {formatDateTime(compile.finishedAt)}
            </span>
          </p>
          {compile.errors.length > 0 ? (
            <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto font-mono text-xs">
              {compile.errors.map((error) => (
                <li key={`${error.file}:${error.line}:${error.message}`}>
                  <span className="text-rose-300">
                    {error.file}:{error.line}
                  </span>{' '}
                  <span className="text-ink-soft">{error.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-ink-muted">Aucune compile enregistrée.</p>
      )}
    </section>
  )
})

const PlaytestCard = memo(function PlaytestCard({ playtest }: { playtest: UnityStatus['lastPlaytest'] }) {
  return (
    <section className={CARD} aria-label="Dernier playtest">
      <h2 className={H2}>Dernier playtest</h2>
      {playtest ? (
        <p className="flex items-center gap-2">
          <StatusDot tone={playtest.passed ? 'ok' : 'danger'} />
          {playtest.passed ? 'réussi' : 'échoué'}
          <span className="text-xs text-ink-muted">
            {playtest.id} · {formatDateTime(playtest.finishedAt)}
          </span>
        </p>
      ) : (
        <p className="text-ink-muted">Aucun playtest enregistré.</p>
      )}
    </section>
  )
})

export default function UnityPage() {
  const query = useUnityStatus()
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <PageHeader title="Unity" />
      <Async query={query} what="État de l'éditeur Unity">
        {(status) => (
          <>
            <EditorCard editor={status.editor} />
            <LockCard lock={status.lock} />
            <CompileCard compile={status.lastCompile} />
            <PlaytestCard playtest={status.lastPlaytest} />
          </>
        )}
      </Async>
      <TestQueueCard />
      <section className={CARD} aria-label="Scénarios et recordings">
        <h2 className={H2}>Scénarios et recordings</h2>
        <p className="text-xs text-ink-faint">P7 : bibliothèque de scénarios, non-régression et enregistrement de repro.</p>
      </section>
    </section>
  )
}
