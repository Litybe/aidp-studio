import { useState } from 'react'
import { useRunDetail } from '../../api/f1queries'
import type { RunDetail, RunStage } from '../../api/types'
import { StatusIcon } from '../../components/StatusIcon'
import { formatDateTime, formatUsd } from '../../lib/format'
import { ICON_LABEL, type IconStatus } from '../../lib/status'
import { Duration } from './Duration'
import { SessionPanel } from './SessionPanel'

/** Longest `signals` text shown for a stage; the full value stays on the daemon. */
const MAX_SIGNALS_CHARS = 800

const RUN_LABEL: Record<string, string> = {
  pending: 'en attente',
  running: 'en cours',
  waiting_gate: 'attend une validation',
  paused: 'en pause',
  done: 'terminé',
  failed: 'échec',
  cancelled: 'annulé',
}

export function stageIconStatus(stage: RunStage, pendingGate: string | null | undefined): IconStatus {
  if (pendingGate && stage.name === pendingGate && stage.status === 'pending') return 'human'
  switch (stage.status) {
    case 'done':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'failure'
    case 'running':
      return 'running'
    case 'skipped':
      return 'skipped'
    default:
      return 'pending'
  }
}

export function runIconStatus(status: string | undefined): IconStatus {
  switch (status) {
    case 'done':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'failure'
    case 'running':
      return 'running'
    case 'waiting_gate':
    case 'paused':
      return 'human'
    default:
      return 'pending'
  }
}

/** Stages that need no further work, over every stage of the run. */
export function stageProgress(stages: readonly RunStage[]): { settled: number; total: number } {
  return {
    settled: stages.filter((stage) => stage.status === 'done' || stage.status === 'skipped').length,
    total: stages.length,
  }
}

/** Sum of the stage costs, null when no stage carries one. */
export function runCost(stages: readonly RunStage[]): number | null {
  const costs = stages.map((stage) => stage.costUsd).filter((value): value is number => typeof value === 'number')
  return costs.length > 0 ? costs.reduce((sum, value) => sum + value, 0) : null
}

/** A plan task or shard is named `<stage>#<id>`. */
function isSubStage(stage: RunStage): boolean {
  return stage.name.includes('#')
}

/** Open by default: the running stage, a failed one, and the one a gate waits on. */
function defaultOpen(stage: RunStage, pendingGate: string | null | undefined): boolean {
  return stage.status === 'running' || stage.status === 'failed' || stage.name === pendingGate
}

function signalsText(signals: unknown): string {
  if (signals === null || signals === undefined) return ''
  const text = typeof signals === 'string' ? signals : JSON.stringify(signals, null, 1)
  return text.length > MAX_SIGNALS_CHARS ? `${text.slice(0, MAX_SIGNALS_CHARS)}…` : text
}

function StageDetail({ stage }: { stage: RunStage }) {
  const sessions = stage.sessionIds ?? []
  const session = sessions[sessions.length - 1] ?? null
  const signals = signalsText(stage.signals)
  const failed = stage.status === 'failed' || stage.status === 'cancelled'
  const empty = !stage.reason && !stage.startedAt && signals === '' && session === null
  return (
    <div className="space-y-2 border-t border-line bg-canvas px-3 py-2 pl-9 font-mono text-xs">
      {stage.reason ? <p className={`whitespace-pre-wrap ${failed ? 'text-st-failure' : 'text-st-running'}`}>{stage.reason}</p> : null}
      {stage.startedAt ? (
        <p className="text-ink-faint">
          {formatDateTime(stage.startedAt)}
          {stage.finishedAt ? ` → ${formatDateTime(stage.finishedAt)}` : ''}
          {stage.resumed ? ' · reprise après interruption' : ''}
        </p>
      ) : null}
      {signals !== '' ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
          <dt className="text-ink-faint">signals</dt>
          <dd className="whitespace-pre-wrap text-ink-soft">{signals}</dd>
        </dl>
      ) : null}
      {empty ? <p className="text-ink-faint">{stage.status === 'pending' ? 'Pas encore exécutée.' : 'Aucun détail.'}</p> : null}
      {session ? (
        <div className="font-sans">
          {sessions.length > 1 ? <p className="mb-1 text-xs text-ink-faint">{`Dernière session sur ${sessions.length}`}</p> : null}
          <SessionPanel sessionId={session} />
        </div>
      ) : null}
    </div>
  )
}

function StageRow({ stage, pendingGate, open, onToggle }: { stage: RunStage; pendingGate: string | null | undefined; open: boolean; onToggle: () => void }) {
  const status = stageIconStatus(stage, pendingGate)
  const attempts = stage.attempts ?? 0
  return (
    <li className={`border-b border-line last:border-b-0 ${isSubStage(stage) ? 'ml-4 border-l-2 border-l-line' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-raised/60"
      >
        <StatusIcon status={status} />
        <span className="min-w-0 truncate font-mono text-ink">{stage.name}</span>
        {status === 'human' ? <span className="rounded bg-st-human/20 px-1.5 text-xs text-st-human">validation humaine</span> : null}
        {attempts > 1 ? <span className="rounded bg-raised px-1.5 text-xs text-ink-soft">{`${attempts} tentatives`}</span> : null}
        <span className="hidden text-xs text-ink-muted sm:inline">{ICON_LABEL[status]}</span>
        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-ink-muted">
          {typeof stage.costUsd === 'number' ? <span>{formatUsd(stage.costUsd)}</span> : null}
          <Duration start={stage.startedAt} end={stage.finishedAt} />
        </span>
      </button>
      {open ? <StageDetail stage={stage} /> : null}
    </li>
  )
}

function PipelineView({ runId, run }: { runId: string; run: RunDetail }) {
  const stages = run.stages ?? []
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const { settled, total } = stageProgress(stages)
  const cost = runCost(stages)
  const status = runIconStatus(run.status)
  const isOpen = (stage: RunStage) => overrides[stage.name] ?? defaultOpen(stage, run.pendingGate)
  return (
    <section aria-label={`Pipeline ${run.templateId ?? runId}`} className="overflow-hidden rounded-md border border-line bg-card font-sans text-sm">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2">
        <StatusIcon status={status} />
        <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Pipeline</span>
        <span className="font-mono font-medium text-ink">{run.templateId ?? runId}</span>
        <span className="text-xs text-ink-muted">{RUN_LABEL[run.status ?? ''] ?? run.status}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-ink-muted">
          <span>{`${settled}/${total} phases`}</span>
          {cost !== null ? <span>{formatUsd(cost)}</span> : null}
          <Duration start={run.startedAt} end={run.endedAt} />
        </span>
      </header>
      {run.reason ? <p className="border-b border-line px-3 py-1.5 font-mono text-xs whitespace-pre-wrap text-st-failure">{run.reason}</p> : null}
      {stages.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-faint">Ce pipeline n'a pas encore de phases.</p>
      ) : (
        <ul aria-label="Phases du pipeline">
          {stages.map((stage) => (
            <StageRow
              key={stage.name}
              stage={stage}
              pendingGate={run.pendingGate}
              open={isOpen(stage)}
              onToggle={() => setOverrides((current) => ({ ...current, [stage.name]: !isOpen(stage) }))}
            />
          ))}
        </ul>
      )}
      <p className="border-t border-line px-3 py-1 font-mono text-xs text-ink-faint">{runId}</p>
    </section>
  )
}

/** The pipeline a flow step started: its stages (phases) with status, cost and session. Falls back to the session stream when the id is a plain session. */
export function PipelinePanel({ runId }: { runId: string }) {
  const run = useRunDetail(runId, true)
  if (run.isPending) return <p className="font-sans text-xs text-ink-faint">Chargement du pipeline…</p>
  if (run.data?.stages) return <PipelineView runId={runId} run={run.data} />
  return <SessionPanel sessionId={runId} />
}

/** In a closed step row: the pipeline template and how many of its phases are settled. */
export function PipelineBadge({ runId }: { runId: string }) {
  const run = useRunDetail(runId, true).data
  if (!run?.stages) return null
  const { settled, total } = stageProgress(run.stages)
  return (
    <span className="hidden shrink-0 rounded border border-line px-1.5 text-xs text-ink-muted sm:inline" title="Pipeline et phases terminées">
      {`${run.templateId ?? 'pipeline'} · ${settled}/${total}`}
    </span>
  )
}
