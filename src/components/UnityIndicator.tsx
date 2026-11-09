import { memo } from 'react'
import { isMissing } from '../api/send'
import { unitySummary, useUnityStatus } from '../pages/unity/queries'
import { StatusDot } from './StatusDot'

/** `Unity : ouvert, verrou #214`, or `inconnu` while the daemon has no `GET /api/unity/status`. */
export const UnityIndicator = memo(function UnityIndicator({ className = '' }: { className?: string }) {
  const query = useUnityStatus()
  if (!query.data) {
    const title = query.error && isMissing(query.error) ? "GET /api/unity/status n'existe pas encore" : 'état Unity indisponible'
    return (
      <span className={`flex items-center gap-2 ${className}`} title={title}>
        <StatusDot tone="muted" />
        <span className="truncate text-ink-faint">Unity : inconnu</span>
      </span>
    )
  }
  const { text, tone } = unitySummary(query.data)
  return (
    <span className={`flex items-center gap-2 ${className}`} title={query.data.editor.projectPath ?? undefined}>
      <StatusDot tone={tone} />
      <span className="truncate text-ink-muted">Unity : {text}</span>
    </span>
  )
})
