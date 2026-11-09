import { useConnection, useRealtime, useTicker } from '../realtime/context'
import type { ConnectionState } from '../realtime/events'
import { BUTTON_PRIMARY } from './ui/classes'
import { Icon } from './ui/Icon'

const selectNextRetry = (state: ConnectionState) => state.nextRetryAt
const selectAttempts = (state: ConnectionState) => state.attempts

/** Shown while the daemon does not answer; the stream retries on its own with a capped backoff. */
export function UnreachablePage() {
  const { stream } = useRealtime()
  const nextRetryAt = useConnection(selectNextRetry)
  const attempts = useConnection(selectAttempts)
  const seconds = useTicker((nowMs) =>
    nextRetryAt === null ? null : Math.max(0, Math.ceil((nextRetryAt - nowMs) / 1000)),
  )
  return (
    <section className="mx-auto mt-16 max-w-lg rounded-card border border-rose-900/60 bg-rose-950/30 p-6" role="alert">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-rose-900/50 text-rose-300">
          <Icon name="alert" size={20} />
        </span>
        <h1 className="text-lg font-semibold text-rose-100">Daemon injoignable</h1>
      </div>
      <p className="mt-4 text-ink-muted">
        <code className="text-ink">127.0.0.1:3001</code> ne répond pas. Lance-le avec :
      </p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-canvas p-3 text-xs text-ink">aidp gateway serve --ui-dir D:\AIDP\src\aidp-studio\dist</pre>
      <p className="mt-3 text-ink-faint">
        {seconds === null ? "Nouvel essai au retour sur l'onglet." : `Nouvel essai dans ${seconds} s`} (tentative {attempts}).
      </p>
      <button type="button" className={`${BUTTON_PRIMARY} mt-4`} onClick={() => stream.retryNow()}>
        <Icon name="refresh" size={14} />
        Réessayer maintenant
      </button>
    </section>
  )
}
