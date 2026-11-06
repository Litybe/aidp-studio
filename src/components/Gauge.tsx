import { memo } from 'react'
import { computeGauge, resetLabel, RESET_PASSED, type GaugeLevel, type GaugeSource } from '../lib/gauge'
import { useTicker } from '../realtime/context'

const BAR_COLOR: Record<GaugeLevel, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-400',
  danger: 'bg-rose-500',
  unknown: 'bg-slate-600',
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
}

/** A static bar (no animation, no transition): percent, colour by threshold, live reset countdown. */
export const Gauge = memo(function Gauge({ label, utilization, resetsAtMs, limit, source }: GaugeProps) {
  const reset = useTicker((nowMs) => resetLabel(resetsAtMs, nowMs))
  const model = computeGauge({ utilization, resetsAtMs, limit }, reset === RESET_PASSED)
  const percentText = model.percent === null ? '—' : `${model.percent}%`
  const title = [
    `${label} : ${percentText} (seuil ${Math.round(limit * 100)}%)`,
    resetsAtMs === null ? 'reset inconnu' : `reset le ${RESET_FORMAT.format(resetsAtMs)}`,
    SOURCE_LABEL[source],
  ].join(' · ')
  return (
    <div className="flex items-center gap-2" title={title} data-testid={`gauge-${label}`} data-level={model.level}>
      <span className="font-medium text-slate-300">{label}</span>
      <div
        className="h-2 w-20 overflow-hidden rounded-sm bg-slate-800"
        role="meter"
        aria-label={`Fenêtre ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={model.percent ?? 0}
        aria-valuetext={`${percentText}, ${reset}`}
      >
        <div className={`h-full ${BAR_COLOR[model.level]}`} style={{ width: `${model.percent ?? 0}%` }} />
      </div>
      <span className="tabular-nums text-slate-200">{percentText}</span>
      <span className="text-xs text-slate-400">{reset}</span>
    </div>
  )
})
