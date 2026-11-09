import { memo } from 'react'
import { type Tone } from '../../components/ui/classes'
import { Icon } from '../../components/ui/Icon'
import { elapsedLabel, formatTokens } from '../../lib/format'
import { useTicker } from '../../realtime/context'
import type { TimelinePhase, TimelineStep } from './flowTimeline'

const TONE: Record<string, Tone> = {
  done: 'ok',
  skipped: 'muted',
  pending: 'muted',
  running: 'accent',
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

/** The marker on the rail: a filled dot by tone, a check once done, a hollow ring while pending. */
const MARK: Record<Tone, string> = {
  ok: 'border-emerald-500 bg-emerald-500 text-slate-950',
  warn: 'border-amber-400 bg-amber-400 text-slate-950',
  danger: 'border-rose-500 bg-rose-500 text-white',
  muted: 'border-line-strong bg-card text-ink-faint',
  accent: 'border-sky-400 bg-sky-400 text-slate-950',
  violet: 'border-violet-400 bg-violet-400 text-slate-950',
}

function Duration({ step }: { step: TimelineStep }) {
  const running = step.status === 'running'
  const live = useTicker((now) => (running ? elapsedLabel(step.state?.started_at, null, now) : ''))
  return <span>{running ? live : elapsedLabel(step.state?.started_at, step.state?.finished_at, 0)}</span>
}

const Row = memo(function Row({ step, current }: { step: TimelineStep; current: boolean }) {
  const tone = TONE[step.status] ?? 'muted'
  return (
    <li className={`relative flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md py-1.5 pl-8 pr-2 text-sm ${current ? 'bg-raised/70' : ''}`} aria-current={current ? 'step' : undefined}>
      <span aria-hidden="true" className={`absolute left-[0.6875rem] top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full border-2 ${MARK[tone]} ${step.status === 'pending' ? 'bg-transparent' : ''}`}>
        {step.status === 'done' ? <Icon name="check" size={9} strokeWidth={3} /> : null}
        {step.status === 'skipped' ? <span className="h-px w-1.5 bg-current" /> : null}
      </span>
      <span className={`font-mono ${step.status === 'pending' ? 'text-ink-muted' : 'text-ink'}`}>{step.id}</span>
      <span className={`text-xs ${tone === 'muted' ? 'text-ink-faint' : tone === 'danger' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : tone === 'accent' ? 'text-accent' : 'text-ink-muted'}`}>
        {LABEL[step.status] ?? step.status}
      </span>
      {step.iteration > 1 ? <span className="text-xs text-ink-faint">itération {step.iteration}</span> : null}
      <span className="ml-auto flex gap-3 text-xs text-ink-faint tabular-nums">
        {step.tokens !== null ? <span>{formatTokens(step.tokens)}</span> : null}
        <Duration step={step} />
      </span>
      {step.state?.reason ? <span className="w-full text-xs text-amber-300">{step.state.reason}</span> : null}
    </li>
  )
})

/** The steps of the flow by phase, on one vertical rail; the current step is highlighted. */
export const Timeline = memo(function Timeline({ phases, current }: { phases: readonly TimelinePhase[]; current: string | null }) {
  if (phases.length === 0) return <p className="text-xs text-ink-faint">Aucune étape.</p>
  return (
    <div className="relative space-y-4">
      <span aria-hidden="true" className="absolute bottom-3 left-[1.0625rem] top-3 w-px bg-line-strong" />
      {phases.map((phase) => (
        <section key={phase.phase} aria-label={`Phase ${phase.phase}`}>
          <h3 className="mb-1 pl-8 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">{phase.phase}</h3>
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
