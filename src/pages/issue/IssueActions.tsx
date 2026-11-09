import { useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import type { FlowRun } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { BUTTON, INPUT, SELECT } from '../../components/ui/classes'

const ACTIVE = new Set(['running', 'pausing', 'waiting_human', 'waiting_external'])
const RETRYABLE = new Set(['failed', 'escalated'])

function ManualForm({ flowKey }: { flowKey: string }) {
  const [mode, setMode] = useState<'action' | 'pipeline'>('action')
  const [name, setName] = useState('')
  const manual = useApiAction((body: unknown) => apiPost(routes.flowManual(flowKey), body))
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (name.trim() !== '') manual.run({ [mode]: name.trim() })
      }}
    >
      <select
        aria-label="Type de lancement manuel"
        className={`${SELECT} py-1 text-xs`}
        value={mode}
        onChange={(event) => setMode(event.target.value as 'action' | 'pipeline')}
      >
        <option value="action">Action</option>
        <option value="pipeline">Pipeline</option>
      </select>
      <input
        aria-label="Nom de l'action ou du pipeline"
        className={`${INPUT} py-1 text-xs`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="ex. fix-review"
      />
      <button
        type="submit"
        disabled={name.trim() === '' || manual.feedback.pending}
        className={BUTTON}
      >
        Lancer
      </button>
      <FeedbackLine feedback={manual.feedback} />
    </form>
  )
}

/** The gate decision (approve / reject), shown on the highlighted human step of the flow page. */
export function GateActions({ flow }: { flow: FlowRun }) {
  const post = useApiAction((path: string) => apiPost(path))
  const current = flow.current ?? null
  if (!current || flow.steps[current]?.status !== 'waiting_human') return null
  const run = (path: string) => () => post.run(path)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton label="Approuver" tone="primary" icon="check" onRun={run(routes.step(flow.key, current, 'approve'))} />
      <ActionButton
        label="Rejeter"
        tone="danger"
        confirm={`Rejeter ${current} ? Le flow s'arrête.`}
        onRun={run(routes.step(flow.key, current, 'reject'))}
      />
      <FeedbackLine feedback={post.feedback} />
    </div>
  )
}

/** Flow-level actions: retry/skip of a step, pause/resume, manual launch (the gate has its own buttons). */
export function IssueActions({ flow }: { flow: FlowRun }) {
  const post = useApiAction((path: string) => apiPost(path))
  const current = flow.current ?? null
  const state = current ? flow.steps[current] : undefined
  const status = state?.status
  const failedStep = Object.entries(flow.steps).find(([, step]) => RETRYABLE.has(step.status))?.[0] ?? null
  const retryId = failedStep ?? (status && RETRYABLE.has(status) ? current : null)
  const run = (path: string) => () => post.run(path)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {retryId ? <ActionButton label="Relancer l'étape" tone="primary" icon="refresh" onRun={run(routes.step(flow.key, retryId, 'retry'))} /> : null}
        {current && ACTIVE.has(flow.status) ? (
          <ActionButton
            label="Passer l'étape"
            confirm={`Passer l'étape ${current} ?`}
            onRun={run(routes.step(flow.key, current, 'skip'))}
          />
        ) : null}
        {ACTIVE.has(flow.status) ? <ActionButton label="Pause du flow" icon="pause" onRun={run(routes.flowPause(flow.key))} /> : null}
        {flow.status === 'paused' ? (
          <ActionButton label="Reprendre le flow" tone="primary" icon="play" onRun={run(routes.flowResume(flow.key))} />
        ) : null}
        <FeedbackLine feedback={post.feedback} />
      </div>
      <details className="text-xs text-ink-muted">
        <summary className="inline-block min-h-10 cursor-pointer py-2 select-none">Lancement manuel</summary>
        <div className="mt-1">
          <ManualForm flowKey={flow.key} />
        </div>
      </details>
    </div>
  )
}
