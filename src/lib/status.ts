import type { FlowStatus, StepStatus } from '../api/types'

/** The six states the UI draws, whatever the source (step, job, flow, ticket). */
export type IconStatus = 'success' | 'failure' | 'running' | 'pending' | 'skipped' | 'human'

export const ICON_LABEL: Record<IconStatus, string> = {
  success: 'réussi',
  failure: 'échec',
  running: 'en cours',
  pending: 'en attente',
  skipped: 'ignoré',
  human: 'action humaine',
}

export const ICON_COLOR: Record<IconStatus, string> = {
  success: 'text-st-success',
  failure: 'text-st-failure',
  running: 'text-st-running',
  pending: 'text-st-pending',
  skipped: 'text-st-skipped',
  human: 'text-st-human',
}

export function stepIconStatus(status: StepStatus | string): IconStatus {
  switch (status) {
    case 'done':
      return 'success'
    case 'failed':
    case 'escalated':
      return 'failure'
    case 'running':
    case 'waiting_external':
      return 'running'
    case 'waiting_human':
      return 'human'
    case 'skipped':
      return 'skipped'
    default:
      return 'pending'
  }
}

export function flowIconStatus(status: FlowStatus | string): IconStatus {
  switch (status) {
    case 'done':
    case 'completed':
      return 'success'
    case 'failed':
    case 'escalated':
    case 'aborted':
      return 'failure'
    case 'running':
    case 'pausing':
    case 'waiting_external':
      return 'running'
    case 'waiting_human':
      return 'human'
    default:
      return 'pending'
  }
}

export const STEP_LABEL: Record<string, string> = {
  pending: 'à venir',
  running: 'en cours',
  waiting_human: 'attend une décision',
  waiting_external: 'attend un hôte',
  done: 'fait',
  skipped: 'passée',
  failed: 'échec',
  escalated: 'escaladée',
}

export const FLOW_LABEL: Record<string, string> = {
  running: 'en cours',
  paused: 'en pause',
  pausing: 'mise en pause',
  waiting_human: 'attend une décision',
  waiting_external: 'attend un hôte',
  done: 'terminé',
  failed: 'échec',
  escalated: 'escaladé',
  aborted: 'abandonné',
}
