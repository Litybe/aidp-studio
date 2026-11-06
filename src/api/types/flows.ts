// A flow run as `GET /api/flows/:key` serves it: the serialized `FlowState` (snake_case) plus
// `repo`, `inbox`, `sessions` and `pr`.

export type FlowStatus =
  | 'running'
  | 'paused'
  | 'pausing'
  | 'waiting_human'
  | 'waiting_external'
  | 'done'
  | 'failed'
  | 'escalated'
  | 'aborted'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'waiting_human'
  | 'waiting_external'
  | 'done'
  | 'skipped'
  | 'failed'
  | 'escalated'

export interface StepState {
  status: StepStatus
  reason?: string | null
  detail?: string | null
  outputs?: Record<string, unknown>
  iteration?: number
  started_at?: string | null
  finished_at?: string | null
  phase?: string | null
}

export interface StepDef {
  id: string
  kind?: string
  phase?: string | null
  prompt?: string | null
  choices?: string[]
  body?: StepDef[]
}

export interface FlowInboxItem {
  id: string
  step: string
  iteration: number
  prompt?: string | null
  choices?: string[]
  created_at: string
}

export interface FlowRun {
  key: string
  def: { id: string; version: number; steps: StepDef[] }
  status: FlowStatus
  current?: string | null
  steps: Record<string, StepState>
  started_at?: string | null
  ended_at?: string | null
  repo?: string
  inbox?: FlowInboxItem[]
  /** Effect id `<step>:<iteration>:start_pipeline` to native run id or session id. */
  sessions?: Record<string, string>
  pr?: { number: number; url?: string | null; repository?: string | null } | null
}

/** One line of `GET /api/flows/:key/journal`. */
export interface JournalLine {
  step?: string | null
  from?: string | null
  to?: string | null
  reason?: string | null
  actor?: string | null
  time?: string | null
}
