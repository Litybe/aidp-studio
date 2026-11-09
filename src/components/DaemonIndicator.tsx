import { useConnection } from '../realtime/context'
import type { ConnectionPhase, ConnectionState } from '../realtime/events'
import { StatusDot, type DotTone } from './StatusDot'

const PHASE: Record<ConnectionPhase, { tone: DotTone; label: string }> = {
  connecting: { tone: 'muted', label: 'connexion…' },
  open: { tone: 'ok', label: 'daemon' },
  reconnecting: { tone: 'warn', label: 'reconnexion…' },
  unreachable: { tone: 'danger', label: 'daemon injoignable' },
}

const selectPhase = (state: ConnectionState) => state.phase

/** State of the SSE stream to the daemon: the realtime link and the daemon's health in one dot. */
export function DaemonIndicator({ className = '' }: { className?: string }) {
  const phase = useConnection(selectPhase)
  const { tone, label } = PHASE[phase]
  return (
    <span className={`flex items-center gap-2 ${className}`} data-testid="daemon-indicator" data-phase={phase}>
      <StatusDot tone={tone} />
      <span className="truncate text-ink-muted">{label}</span>
    </span>
  )
}
