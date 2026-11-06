import { memo } from 'react'
import { type DotTone, StatusDot } from '../../components/StatusDot'
import { elapsedLabel, formatTokens } from '../../lib/format'
import { useTicker } from '../../realtime/context'
import type { TimelinePhase, TimelineStep } from './flowTimeline'

const TONE: Record<string, DotTone> = {
  done: 'ok',
  skipped: 'muted',
  pending: 'muted',
  running: 'warn',
  waiting_human: 'warn',
  waiting_external: 'warn',
  failed: 'danger',
  escalated: 'danger',
}

const LABEL: Record<string, string> = {
  pending: 'à venir',
  running: 'en cours',
  waiting_human: 'attend une décision',
  waiting_external: 'attend un hôte',
  done: 'fait',
  skipped: 'passée',
  failed: 'échec',
  escalated: 'escaladée',
}

function Duration({ step }: { step: TimelineStep }) {
  const running = step.status === 'running'
  const live = useTicker((now) => (running ? elapsedLabel(step.state?.started_at, null, now) : ''))
  return <span>{running ? live : elapsedLabel(step.state?.started_at, step.state?.finished_at, 0)}</span>
}

const Row = memo(function Row({ step, current }: { step: TimelineStep; current: boolean }) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 px-2 py-1 text-sm ${current ? 'rounded bg-slate-800/70' : ''}`}
      aria-current={current ? 'step' : undefined}
    >
      <StatusDot tone={TONE[step.status] ?? 'muted'} />
      <span className="font-mono text-slate-100">{step.id}</span>
      <span className="text-xs text-slate-400">{LABEL[step.status] ?? step.status}</span>
      {step.iteration > 1 ? <span className="text-xs text-slate-500">itération {step.iteration}</span> : null}
      <span className="ml-auto flex gap-3 text-xs text-slate-500">
        {step.tokens !== null ? <span>{formatTokens(step.tokens)}</span> : null}
        <Duration step={step} />
      </span>
      {step.state?.reason ? <span className="w-full pl-5 text-xs text-amber-400">{step.state.reason}</span> : null}
    </li>
  )
})

export const Timeline = memo(function Timeline({
  phases,
  current,
}: {
  phases: readonly TimelinePhase[]
  current: string | null
}) {
  return (
    <div className="space-y-3">
      {phases.map((phase) => (
        <section key={phase.phase} aria-label={`Phase ${phase.phase}`}>
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{phase.phase}</h3>
          <ul>
            {phase.steps.map((step) => (
              <Row key={step.id} step={step} current={step.id === current} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
})
