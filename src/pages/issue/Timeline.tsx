import { memo, useCallback, useMemo, useState } from 'react'
import type { FlowRun } from '../../api/types'
import { StatusIcon } from '../../components/StatusIcon'
import { formatDateTime } from '../../lib/format'
import { useIsMobile } from '../../lib/media'
import { FLOW_LABEL, flowIconStatus, ICON_LABEL } from '../../lib/status'
import { buildJobs, defaultJob, type Job } from './flowJobs'
import { GateActions } from './IssueActions'
import { Duration, StepList } from './StepList'

const CONNECTOR_COLOR: Record<string, string> = { success: 'var(--color-st-success)', failure: 'var(--color-st-failure)' }

/** Static line + arrowhead between two job boxes; green once the job before it succeeded. */
function Connector({ from }: { from: Job }) {
  const color = CONNECTOR_COLOR[from.status] ?? 'var(--color-line)'
  return (
    <svg width="36" height="12" viewBox="0 0 36 12" aria-hidden="true" className="shrink-0">
      <line x1="0" y1="6" x2="30" y2="6" stroke={color} strokeWidth="2" />
      <path d="M26 2l6 4-6 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function JobBox({ job, selected, onSelect }: { job: Job; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(job.id)}
      className={`flex w-44 shrink-0 flex-col gap-1 rounded-md border px-3 py-2 text-left ${selected ? 'border-accent bg-raised' : 'border-line bg-card hover:bg-raised'}`}
    >
      <span className="flex items-center gap-2">
        <StatusIcon status={job.status} />
        <span className="min-w-0 truncate font-medium text-ink">{job.phase}</span>
      </span>
      <span className="flex items-center justify-between text-xs text-ink-muted">
        <span>{ICON_LABEL[job.status]}</span>
        <Duration start={job.startedAt} end={job.endedAt} />
      </span>
    </button>
  )
}

/** Desktop: the jobs left to right, linked by static SVG lines. Scrolls inside its own box when long. */
function JobGraph({ jobs, selected, onSelect }: { jobs: readonly Job[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <ol className="flex items-center overflow-x-auto rounded-md border border-line bg-canvas p-4" aria-label="Graphe des jobs">
      {jobs.map((job, index) => (
        <li key={job.id} className="flex items-center">
          {index > 0 ? <Connector from={jobs[index - 1] as Job} /> : null}
          <JobBox job={job} selected={job.id === selected} onSelect={onSelect} />
        </li>
      ))}
    </ol>
  )
}

function Summary({ flow, jobs }: { flow: FlowRun; jobs: readonly Job[] }) {
  const status = flowIconStatus(flow.status)
  const total = jobs.reduce((sum, job) => sum + job.steps.length, 0)
  const finished = jobs.reduce((sum, job) => sum + job.finished, 0)
  return (
    <div className="space-y-2 px-3 py-2">
      <p className="flex items-center gap-2 font-medium text-ink">
        <StatusIcon status={status} />
        {FLOW_LABEL[flow.status] ?? flow.status}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-ink-faint">Flow</dt>
        <dd className="truncate text-ink-soft">{flow.def.id}</dd>
        <dt className="text-ink-faint">Étapes</dt>
        <dd className="text-ink-soft">
          {finished}/{total}
        </dd>
        <dt className="text-ink-faint">Durée</dt>
        <dd className="text-ink-soft">
          <Duration start={flow.started_at} end={flow.ended_at} />
        </dd>
        <dt className="text-ink-faint">Début</dt>
        <dd className="text-ink-soft">{formatDateTime(flow.started_at)}</dd>
      </dl>
    </div>
  )
}

function Sidebar({ flow, jobs, selected, onSelect }: { flow: FlowRun; jobs: readonly Job[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <aside className="w-56 shrink-0 self-start rounded-md border border-line bg-card" aria-label="Résumé et jobs">
      <Summary flow={flow} jobs={jobs} />
      <h3 className="border-t border-line px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">Jobs</h3>
      <ul className="pb-1">
        {jobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              aria-current={job.id === selected ? 'true' : undefined}
              onClick={() => onSelect(job.id)}
              className={`flex min-h-9 w-full items-center gap-2 border-l-2 px-3 py-1 text-left ${job.id === selected ? 'border-accent bg-raised text-ink' : 'border-transparent text-ink-soft hover:bg-raised'}`}
            >
              <StatusIcon status={job.status} />
              <span className="min-w-0 flex-1 truncate">{job.phase}</span>
              <span className="text-xs text-ink-muted">
                <Duration start={job.startedAt} end={job.endedAt} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** The decision a human step waits for, like a deployment approval: prompt, then the buttons. */
export function GateCard({ flow }: { flow: FlowRun }) {
  const current = flow.current ?? null
  if (!current || flow.steps[current]?.status !== 'waiting_human') return null
  const item = [...(flow.inbox ?? [])].reverse().find((entry) => entry.step === current)
  return (
    <div className="space-y-2 rounded-md border border-st-human/60 bg-st-human/10 p-3" role="group" aria-label="Validation requise">
      <p className="flex items-center gap-2 font-medium text-ink">
        <StatusIcon status="human" />
        <span>
          Validation requise : <span className="font-mono">{current}</span>
        </span>
      </p>
      {item?.prompt ? <p className="text-ink-soft">{item.prompt}</p> : null}
      <GateActions flow={flow} />
    </div>
  )
}

interface AccordionProps {
  flow: FlowRun
  jobs: readonly Job[]
  open: ReadonlySet<string>
  onToggle: (id: string) => void
  overrides: Readonly<Record<string, boolean>>
  onStep: (id: string, open: boolean) => void
}

/** Phone: the jobs as a vertical list joined by a line; a tap opens the steps in place. */
function JobAccordion({ flow, jobs, open, onToggle, overrides, onStep }: AccordionProps) {
  return (
    <ol className="relative" aria-label="Jobs">
      {jobs.map((job, index) => {
        const isOpen = open.has(job.id)
        return (
          <li key={job.id} className="relative pb-2 pl-8">
            {index < jobs.length - 1 ? <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-line" /> : null}
            <span className="absolute top-3 left-0 flex size-6 items-center justify-center rounded-full bg-canvas">
              <StatusIcon status={job.status} size={18} />
            </span>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggle(job.id)}
              className="flex min-h-12 w-full items-center gap-2 rounded-md border border-line bg-card px-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{job.phase}</span>
                <span className="block text-xs text-ink-muted">
                  {ICON_LABEL[job.status]} · {job.finished}/{job.steps.length}
                </span>
              </span>
              <span className="text-xs text-ink-muted">
                <Duration start={job.startedAt} end={job.endedAt} />
              </span>
            </button>
            {isOpen ? (
              <div className="mt-1">
                <StepList job={job} flow={flow} overrides={overrides} onToggle={onStep} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** The flow as a workflow run: summary and jobs on the left, job graph and step list in the middle. */
export const Timeline = memo(function Timeline({ flow, showGate = true }: { flow: FlowRun; showGate?: boolean }) {
  const mobile = useIsMobile()
  const jobs = useMemo(() => buildJobs(flow), [flow])
  const [picked, setPicked] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [openJobs, setOpenJobs] = useState<ReadonlySet<string> | null>(null)
  const onStep = useCallback((id: string, open: boolean) => setOverrides((current) => ({ ...current, [id]: open })), [])

  if (jobs.length === 0) return <p className="text-ink-faint">Ce flow n'a pas encore d'étapes.</p>
  const selected = picked && jobs.some((job) => job.id === picked) ? picked : defaultJob(jobs)
  const job = jobs.find((entry) => entry.id === selected) ?? jobs[0]

  if (mobile) {
    const open = openJobs ?? new Set(selected ? [selected] : [])
    const toggle = (id: string) =>
      setOpenJobs(() => {
        const next = new Set(open)
        if (!next.delete(id)) next.add(id)
        return next
      })
    return (
      <div className="space-y-3">
        {showGate ? <GateCard flow={flow} /> : null}
        <JobAccordion flow={flow} jobs={jobs} open={open} onToggle={toggle} overrides={overrides} onStep={onStep} />
      </div>
    )
  }
  return (
    <div className="flex items-start gap-4">
      <Sidebar flow={flow} jobs={jobs} selected={selected} onSelect={setPicked} />
      <div className="min-w-0 flex-1 space-y-3">
        {showGate ? <GateCard flow={flow} /> : null}
        <JobGraph jobs={jobs} selected={selected} onSelect={setPicked} />
        {job ? <StepList job={job} flow={flow} overrides={overrides} onToggle={onStep} /> : null}
      </div>
    </div>
  )
})
