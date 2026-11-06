import { memo } from 'react'
import { resetLabel } from '../lib/gauge'
import { useTicker } from '../realtime/context'

/** A live label (`reset 2 h 5 min`) from the global 1 Hz ticker; re-renders when the label changes. */
export const Countdown = memo(function Countdown({ resetsAtMs }: { resetsAtMs: number | null }) {
  const label = useTicker((nowMs) => resetLabel(resetsAtMs, nowMs))
  return <span className="text-xs text-slate-400">{label}</span>
})
