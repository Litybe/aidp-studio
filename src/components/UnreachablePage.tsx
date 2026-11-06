import { useConnection, useRealtime, useTicker } from '../realtime/context'
import type { ConnectionState } from '../realtime/events'

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
    <section className="mx-auto mt-16 max-w-lg rounded border border-rose-900 bg-rose-950/40 p-6" role="alert">
      <h1 className="text-lg font-semibold text-rose-200">Daemon injoignable</h1>
      <p className="mt-2 text-slate-300">
        <code>127.0.0.1:3001</code> ne répond pas. Lance-le avec{' '}
        <code className="text-slate-100">aidp gateway serve --ui-dir D:\AIDP\src\aidp-studio\dist</code>.
      </p>
      <p className="mt-3 text-slate-400">
        {seconds === null ? "Nouvel essai au retour sur l'onglet." : `Nouvel essai dans ${seconds} s`} (tentative{' '}
        {attempts}).
      </p>
      <button
        type="button"
        className="mt-4 rounded bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700"
        onClick={() => stream.retryNow()}
      >
        Réessayer maintenant
      </button>
    </section>
  )
}
