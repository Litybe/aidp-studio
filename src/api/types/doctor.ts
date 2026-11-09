// The incidents of the pipeline doctor, as `GET /api/flows/:key/doctor` serves them (camelCase;
// `diagnosis` keeps the snake_case keys of `diagnosis.json`).

export type DoctorTrigger = 'flow_failed' | 'flow_escalated' | 'run_paused' | 'step_stuck' | 'waiting_too_long'

export type DoctorStatus =
  | 'detected'
  | 'investigating'
  | 'fixed'
  | 'action_failed'
  | 'needs_human'
  | 'refused'
  | 'no_action'
  | 'investigation_failed'
  | 'capped'

export interface DoctorDiagnosis {
  category: string
  cause: string
  evidence?: unknown[]
  confidence: number
  action: string
  params?: Record<string, unknown>
  needs_human: boolean
  proposed_patch?: string | null
  summary: string
}

export interface DoctorOutcome {
  action: string
  idempotencyKey: string
  ok: boolean
  detail: string
  at: string
}

export interface DoctorIncident {
  id: string
  key: string
  ticket: string
  trigger: DoctorTrigger
  step?: string
  iteration?: number
  runId?: string
  detail: string
  status: DoctorStatus
  detectedAt: string
  updatedAt: string
  investigationRunId?: string
  bundle?: string
  diagnosis?: DoctorDiagnosis
  outcome?: DoctorOutcome
  note?: string
  commented: boolean
}

/** `GET /api/flows/:key/doctor`. */
export interface FlowDoctor {
  key: string
  enabled: boolean
  incidents: DoctorIncident[]
}
