import { memo } from 'react'
import type { FlowRun } from '../../api/types'
import { StatusIcon } from '../../components/StatusIcon'
import { elapsedLabel, formatDateTime, formatTokens } from '../../lib/format'
import { STEP_LABEL, stepIconStatus } from '../../lib/status'
import { useTicker } from '../../realtime/context'
import { isHumanStep, type Job, type JobStep } from './flowJobs'
import { sessionOfStep } from './flowTimeline'
import { SessionPanel } from './SessionPanel'

/** Longest value or output shown in a step; the full text stays on the daemon. */
const MAX_VALUE_CHARS = 800
const MAX_OUTPUTS = 20

export function Duration({ start, end }: { start: string | null | undefined; end: string | null | undefined }) {
  const running = Boolean(start) && !end
  const live = useTicker((now) => (running ? elapsedLabel(start, null, now) : ''))
  return <span className="tabular-nums">{running ? live : elapsedLabel(start, end, 0)}</span>
}

function show(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text
}

function warningsOf(outputs: Record<string, unknown> | undefined): string[] {
  const raw = outputs?.['warnings'] ?? outputs?.['warning']
  if (Array.isArray(raw)) return raw.map(show)
  return typeof raw === 'string' && raw !== '' ? [raw] : []
}

function Detail({ step, flow }: { step: JobStep; flow: FlowRun }) {
  const state = step.state
  const outputs = Object.entries(state?.outputs ?? {})
    .filter(([key]) => key !== 'warnings' && key !== 'warning')
    .slice(0, MAX_OUTPUTS)
  const warnings = warningsOf(state?.outputs)
  const session = sessionOfStep(flow, step.id)
  const failed = step.status === 'failed' || step.status === 'escalated'
  const empty = !state?.reason && !state?.detail && outputs.length === 0 && warnings.length === 0 && !session && !state?.started_at
  return (
    <div className="space-y-2 border-t border-line-soft bg-bg px-3 py-2 pl-9 font-mono text-xs">
      {state?.reason ? <p className="text-st-running">{state.reason}</p> : null}
      {state?.detail ? (
        <pre className={`whitespace-pre-wrap ${failed ? 'text-st-failure' : 'text-slate-300'}`}>{show(state.detail)}</pre>
      ) : null}
      {warnings.map((warning, index) => (
        <p key={index} className="text-st-running">
          ! {warning}
        </p>
      ))}
      {outputs.length > 0 ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          {outputs.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-slate-500">{key}</dt>
              <dd className="whitespace-pre-wrap text-slate-300">{show(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {state?.started_at ? (
        <p className="text-slate-500">
          {formatDateTime(state.started_at)}
          {state.finished_at ? ` → ${formatDateTime(state.finished_at)}` : ''}
        </p>
      ) : null}
      {empty ? <p className="text-slate-500">{step.status === 'pending' ? 'Pas encore exécutée.' : 'Aucun détail.'}</p> : null}
      {session ? (
        <div className="font-sans">
          <SessionPanel sessionId={session} />
        </div>
      ) : null}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 text-slate-500">
      <path d={open ? 'M2.5 4.2L6 7.8l3.5-3.6' : 'M4.2 2.5L7.8 6 4.2 9.5'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface RowProps {
  step: JobStep
  flow: FlowRun
  open: boolean
  current: boolean
  onToggle: (id: string) => void
}

const Row = memo(function Row({ step, flow, open, current, onToggle }: RowProps) {
  const human = isHumanStep(step) && step.status !== 'done' && step.status !== 'skipped'
  const showIteration = step.iteration > 1 || (step.children > 0 && step.iteration > 0)
  const label = step.status === 'done' || step.status === 'pending' ? '' : (STEP_LABEL[step.status] ?? step.status)
  return (
    <li
      className={`border-b border-line-soft last:border-b-0 ${step.parent ? 'ml-4 border-l-2 border-l-line' : ''} ${human ? 'border-l-2 border-l-st-human bg-st-human/10' : ''}`}
      aria-current={current ? 'step' : undefined}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(step.id)}
        className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800/60"
      >
        <Chevron open={open} />
        <StatusIcon status={stepIconStatus(step.status)} />
        <span className="min-w-0 truncate font-mono text-slate-100">{step.id}</span>
        {step.children > 0 ? <span className="rounded border border-line px-1.5 text-xs text-slate-400">boucle</span> : null}
        {showIteration ? <span className="rounded bg-slate-800 px-1.5 text-xs text-slate-300">{`itération ${step.iteration}`}</span> : null}
        {human ? <span className="rounded bg-st-human/20 px-1.5 text-xs text-st-human">validation humaine</span> : null}
        {label ? <span className="hidden text-xs text-slate-400 sm:inline">{label}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-slate-400">
          {step.tokens !== null ? <span className="hidden sm:inline">{formatTokens(step.tokens)}</span> : null}
          <Duration start={step.state?.started_at} end={step.state?.finished_at} />
        </span>
      </button>
      {open ? <Detail step={step} flow={flow} /> : null}
    </li>
  )
})

/** Open by default: a failed step, and the one the flow is on. */
export function defaultOpen(step: JobStep, current: string | null): boolean {
  return step.status === 'failed' || step.status === 'escalated' || (step.id === current && step.status !== 'pending')
}

export const StepList = memo(function StepList({
  job,
  flow,
  overrides,
  onToggle,
}: {
  job: Job
  flow: FlowRun
  /** Steps the user opened (true) or closed (false) by hand. */
  overrides: Readonly<Record<string, boolean>>
  onToggle: (id: string, open: boolean) => void
}) {
  const current = flow.current ?? null
  const isOpen = (step: JobStep) => overrides[step.id] ?? defaultOpen(step, current)
  return (
    <section aria-label={`Phase ${job.phase}`} className="overflow-hidden rounded-md border border-line bg-surface">
      <ul>
        {job.steps.map((step) => (
          <Row
            key={step.id}
            step={step}
            flow={flow}
            open={isOpen(step)}
            current={step.id === current}
            onToggle={(id) => onToggle(id, !isOpen(step))}
          />
        ))}
      </ul>
    </section>
  )
})
