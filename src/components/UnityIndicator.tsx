import { memo } from 'react'
import { isMissing } from '../api/send'
import { unitySummary, useUnityStatus } from '../pages/unity/queries'
import { StatusDot } from './StatusDot'

/** Top bar: `Unity : ouvert, verrou #214`, or `inconnu` while the daemon has no `GET /api/unity/status`. */
export const UnityIndicator = memo(function UnityIndicator() {
  const query = useUnityStatus()
  if (!query.data) {
    const title = query.error && isMissing(query.error) ? "GET /api/unity/status n'existe pas encore" : 'état Unity indisponible'
    return (
      <span className="flex items-center gap-1.5" title={title}>
        <StatusDot tone="muted" />
        <span className="text-slate-400">Unity : inconnu</span>
      </span>
    )
  }
  const { text, tone } = unitySummary(query.data)
  return (
    <span className="flex items-center gap-1.5" title={query.data.editor.projectPath ?? undefined}>
      <StatusDot tone={tone} />
      <span className="text-slate-300">Unity : {text}</span>
    </span>
  )
})
