import type { FlowRun, StepDef, StepState, StepStatus } from '../../api/types'

export interface TimelineStep {
  id: string
  kind: string
  state: StepState | undefined
  status: StepStatus
  iteration: number
  tokens: number | null
}

export interface TimelinePhase {
  phase: string
  steps: TimelineStep[]
}

const NO_PHASE = 'Sans phase'

function flatten(steps: readonly StepDef[], out: StepDef[] = []): StepDef[] {
  for (const step of steps) {
    out.push(step)
    if (step.body) flatten(step.body, out)
  }
  return out
}

/** Output counters a step may carry (`tokens` or `total_tokens`), null when it has none. */
function tokensOf(state: StepState | undefined): number | null {
  const outputs = state?.outputs
  const value = outputs?.['tokens'] ?? outputs?.['total_tokens']
  return typeof value === 'number' ? value : null
}

/** Phase of the first member of a container step (a loop has none of its own). */
function memberPhase(def: StepDef): string | null | undefined {
  return flatten(def.body ?? []).find((member) => member.phase)?.phase
}

/** Steps of the frozen definition grouped by phase, in definition order. A step without a phase joins its previous step's. */
export function buildTimeline(flow: FlowRun): TimelinePhase[] {
  const phases: TimelinePhase[] = []
  let previous: string = NO_PHASE
  for (const def of flatten(flow.def.steps)) {
    const state = flow.steps[def.id]
    const phase = def.phase ?? state?.phase ?? memberPhase(def) ?? previous
    previous = phase
    let group = phases.find((entry) => entry.phase === phase)
    if (!group) {
      group = { phase, steps: [] }
      phases.push(group)
    }
    group.steps.push({
      id: def.id,
      kind: def.kind ?? '',
      state,
      status: state?.status ?? 'pending',
      iteration: state?.iteration ?? 0,
      tokens: tokensOf(state),
    })
  }
  return phases
}

/** The run id (native pipeline run or session) of the effect `<step>:<iteration>:start_pipeline`. */
export function sessionOfStep(flow: FlowRun, stepId: string | null | undefined): string | null {
  if (!stepId || !flow.sessions) return null
  const prefix = `${stepId}:`
  const hits = Object.entries(flow.sessions).filter(([effect]) => effect.startsWith(prefix))
  return hits.length > 0 ? (hits[hits.length - 1]?.[1] ?? null) : null
}

/** Every distinct run id the step started (one per iteration), oldest first. */
export function runsOfStep(flow: FlowRun, stepId: string): string[] {
  if (!flow.sessions) return []
  const prefix = `${stepId}:`
  const ids = Object.entries(flow.sessions)
    .filter(([effect]) => effect.startsWith(prefix))
    .map(([, id]) => id)
  return [...new Set(ids)]
}

/** Every distinct run id the flow started, oldest first. */
export function runIdsOf(flow: FlowRun | undefined): string[] {
  return flow?.sessions ? [...new Set(Object.values(flow.sessions))] : []
}
