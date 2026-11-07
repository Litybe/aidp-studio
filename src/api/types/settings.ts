// `GET`/`PUT /api/settings/{routing,models}` (C11, F2 daemon) and the catalogs of gateway-api.md.
// The JSON keys are the YAML keys of `TODO/routing.yaml` and `TODO/config.yaml` (snake_case).

import type { Route } from './budget'

export const TRACKS = ['quick', 'standard', 'deep', 'bug'] as const
export type Track = (typeof TRACKS)[number]

/** Criteria of one rule's `match`; at least one is set. Texts match as written, `labels` accept a trailing `*`. */
export interface RuleMatch {
  label?: string
  labels?: string[]
  keywords?: string[]
  component?: string
  epic?: string
  key_prefix?: string
  summary_regex?: string
  issuetype?: string
}

export interface RoutingRule {
  match: RuleMatch
  /** The route target: a key of `repos`. */
  service: string
}

export interface RoutingRepo {
  flow?: string
  template?: string
  track?: Track
  route?: Route
}

/** `TODO/routing.yaml` as JSON; `PUT` replaces each section it carries as a whole. */
export interface RoutingSettings {
  defaults: { track?: Track }
  rules: RoutingRule[]
  repos: Record<string, RoutingRepo>
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

export const MODEL_IDS = ['haiku', 'sonnet', 'opus', 'fable'] as const

/** `models: { <route>: { <stageId>: tier } }` (C5). */
export type ModelPolicy = Record<string, Record<string, string>>

/** `GET /api/settings/models`: the policy, and the usual routes, stage ids and tiers to offer. */
export interface ModelsSettings {
  models: ModelPolicy
  routes: string[]
  stages: string[]
  tiers: string[]
}

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
