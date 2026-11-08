import type { IconStatus } from '../lib/status'
import { StatusIcon } from './StatusIcon'

export type DotTone = 'ok' | 'warn' | 'danger' | 'muted'

const TONE: Record<DotTone, IconStatus> = {
  ok: 'success',
  warn: 'running',
  danger: 'failure',
  muted: 'pending',
}

/** Indicator tones drawn with the app's single status icon: static, no pulse, no glow. */
export function StatusDot({ tone }: { tone: DotTone }) {
  return <StatusIcon status={TONE[tone]} size={14} />
}
