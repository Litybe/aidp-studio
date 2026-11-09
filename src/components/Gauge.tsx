import { memo } from 'react'
import { computeGauge, resetLabel, RESET_PASSED, type GaugeLevel, type GaugeSource } from '../lib/gauge'
import { useTicker } from '../realtime/context'

const BAR_COLOR: Record<GaugeLevel, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  danger: 'bg-rose-400',
  unknown: 'bg-slate-600',
}

const TEXT_COLOR: Record<GaugeLevel, string> = {
  ok: 'text-ink',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
  unknown: 'text-ink-faint',
}

const SOURCE_LABEL: Record<GaugeSource, string> = {
  live: 'mesure en direct',
  history: 'dernier relevé enregistré',
  none: 'aucun relevé',
}

const RESET_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export interface GaugeProps {
  label: string
  utilization: number | null
  resetsAtMs: number | null
  limit: number
  source: GaugeSource
  /** Phone top bar: bar and percent only. */
  compact?: boolean
  /** Budget page: a wide bar with the reset under it. */
  large?: boolean
}

/** A static bar (no animation, no transition): percent, colour by threshold, live reset countdown. */
export const Gauge = memo(function Gauge({ label, utilization, resetsAtMs, limit, source, compact = false, large = false }: GaugeProps) {
  const reset = useTicker((nowMs) => resetLabel(resetsAtMs, nowMs))
  const model = computeGauge({ utilization, resetsAtMs, limit }, reset === RESET_PASSED)
  const percentText = model.percent === null ? '—' : `${model.percent}%`
  const title = [
    `${label} : ${percentText} (seuil ${Math.round(limit * 100)}%)`,
    resetsAtMs === null ? 'reset inconnu' : `reset le ${RESET_FORMAT.format(resetsAtMs)}`,
    SOURCE_LABEL[source],
  ].join(' · ')
  const meter = (
    <div
      className={`relative overflow-hidden rounded-full bg-raised ${large ? 'h-2 w-full' : compact ? 'h-1.5 w-10' : 'h-1.5 w-16'}`}
      role="meter"
      aria-label={`Fenêtre ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={model.percent ?? 0}
      aria-valuetext={`${percentText}, ${reset}`}
    >
      <div className={`h-full rounded-full ${BAR_COLOR[model.level]}`} style={{ width: `${model.percent ?? 0}%` }} />
      {/* The threshold mark. */}
      <span aria-hidden="true" className="absolute top-0 h-full w-px bg-ink/40" style={{ left: `${Math.round(limit * 100)}%` }} />
    </div>
  )
  if (large) {
    return (
      <div className="flex min-w-48 flex-1 flex-col gap-1.5" title={title} data-testid={`gauge-${label}`} data-level={model.level}>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-muted">Fenêtre {label}</span>
          <span className={`text-lg font-semibold tabular-nums ${TEXT_COLOR[model.level]}`}>{percentText}</span>
        </div>
        {meter}
        <span className="text-xs text-ink-faint">
          {reset} · seuil {Math.round(limit * 100)}%
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5" title={title} data-testid={`gauge-${label}`} data-level={model.level}>
      <span className="text-[0.6875rem] font-semibold text-ink-faint">{label}</span>
      {meter}
      <span className={`text-xs tabular-nums ${TEXT_COLOR[model.level]}`}>{percentText}</span>
      {compact ? null : <span className="hidden text-[0.6875rem] text-ink-faint lg:inline">{reset}</span>}
    </div>
  )
})
