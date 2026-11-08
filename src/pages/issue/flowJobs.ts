import type { FlowRun, StepDef } from '../../api/types'
import type { IconStatus } from '../../lib/status'
import { buildTimeline, type TimelineStep } from './flowTimeline'

/** A step of a job; `parent` is the loop (or other container) step it belongs to, if any. */
export interface JobStep extends TimelineStep {
  parent: string | null
  /** Number of steps the container holds (0 for a plain step). */
  children: number
}

/** A job is one `phase` of the flow, like a job of a workflow run. */
export interface Job {
  id: string
  phase: string
  steps: JobStep[]
  status: IconStatus
  startedAt: string | null
  endedAt: string | null
  finished: number
  hasCurrent: boolean
}

function parents(steps: readonly StepDef[], parent: StepDef | null, out: Map<string, StepDef | null>) {
  for (const step of steps) {
    out.set(step.id, parent)
    if (step.body) parents(step.body, step, out)
  }
}

/** Status of a job from its steps: a failure wins, then a human wait, then a live step. */
export function jobStatus(steps: readonly TimelineStep[], current: string | null): IconStatus {
  const status = steps.map((step) => step.status)
  if (status.some((value) => value === 'failed' || value === 'escalated')) return 'failure'
  if (status.includes('waiting_human')) return 'human'
  if (status.some((value) => value === 'running' || value === 'waiting_external')) return 'running'
  if (status.length > 0 && status.every((value) => value === 'skipped')) return 'skipped'
  if (status.length > 0 && status.every((value) => value === 'done' || value === 'skipped')) return 'success'
  if (status.every((value) => value === 'pending')) return 'pending'
  return steps.some((step) => step.id === current) ? 'running' : 'pending'
}

/** The phases of the flow as jobs, in definition order, with loop members flagged. */
export function buildJobs(flow: FlowRun): Job[] {
  const owner = new Map<string, StepDef | null>()
  parents(flow.def.steps, null, owner)
  const current = flow.current ?? null
  return buildTimeline(flow).map((phase) => {
    const steps: JobStep[] = phase.steps.map((step) => ({
      ...step,
      parent: owner.get(step.id)?.id ?? null,
      children: countBody(flow.def.steps, step.id),
    }))
    const started = steps.map((step) => step.state?.started_at).filter((value): value is string => Boolean(value))
    const ended = steps.map((step) => step.state?.finished_at).filter((value): value is string => Boolean(value))
    const finished = steps.filter((step) => step.status === 'done' || step.status === 'skipped').length
    const allEnded = steps.length > 0 && finished === steps.length
    return {
      id: phase.phase,
      phase: phase.phase,
      steps,
      status: jobStatus(steps, current),
      startedAt: started.length > 0 ? started.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null,
      endedAt: allEnded && ended.length > 0 ? ended.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null,
      finished,
      hasCurrent: steps.some((step) => step.id === current),
    }
  })
}

function countBody(steps: readonly StepDef[], id: string): number {
  for (const step of steps) {
    if (step.id === id) return step.body?.length ?? 0
    const inner = step.body ? countBody(step.body, id) : 0
    if (inner > 0) return inner
  }
  return 0
}

/** The job opened first: the one holding the current step, else the first failure, else the last started. */
export function defaultJob(jobs: readonly Job[]): string | null {
  const live = jobs.find((job) => job.hasCurrent)
  if (live) return live.id
  const failed = jobs.find((job) => job.status === 'failure')
  if (failed) return failed.id
  const started = jobs.filter((job) => job.status !== 'pending')
  return (started[started.length - 1] ?? jobs[0])?.id ?? null
}

/** The step is a human gate: waiting for a decision, or defined with a human kind. */
export function isHumanStep(step: TimelineStep): boolean {
  return step.status === 'waiting_human' || /human|approval|gate/i.test(step.kind)
}
