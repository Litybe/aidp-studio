// `GET`/`PUT /api/settings/{routing,models}` (C11, F2 daemon) and the catalogs of gateway-api.md.

export interface RoutingRule {
  match: { label: string }
  service: string
}

export interface RoutingRepo {
  flow?: string
  template?: string
  track?: string
}

/** `TODO/routing.yaml` as JSON (example of PLAN-GAMEDEV.md section 3.2). */
export interface RoutingSettings {
  defaults?: { track?: string }
  rules?: RoutingRule[]
  repos?: Record<string, RoutingRepo>
  [key: string]: unknown
}

export const STAGE_IDS = [
  'prepare',
  'plan',
  'implement',
  'repro',
  'review',
  'verdict',
  'fix',
  'test',
  'report',
  'brief',
  'generate',
  'animate',
  'import',
  'graph',
  'rooms',
  'write',
] as const

export const MODEL_IDS = ['haiku', 'sonnet', 'opus'] as const

/** `models: { <route>: { <stageId>: haiku|sonnet|opus } }` (C5). */
export type ModelsSettings = Record<string, Record<string, string>>

export interface CatalogFlow {
  id: string
  name?: string
  description?: string
}

export interface CatalogTemplate {
  id: string
  name?: string
  stageCount?: number
  inputCount?: number
  source?: string
}

/** `GET /api/dispatcher` `slots`. */
export interface DispatcherSlots {
  used: number
  max: number
}
