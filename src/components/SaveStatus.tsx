import { ApiValidationError } from '../api/send'
import type { SaveFlags } from '../api/types/budget'

/**
 * Outcome of a `PUT /api/settings/*`: the daemon's refusal (its general messages; field errors sit beside
 * their field), or « Enregistré » with the reply flags: a restart to apply it, or nothing to change.
 */
export function SaveStatus({ error, saved }: { error: unknown; saved?: SaveFlags | undefined }) {
  if (error instanceof ApiValidationError) {
    return (
      <span role="alert" className="text-xs text-rose-400">
        {[error.message, ...error.general].join(' ; ')}
      </span>
    )
  }
  if (error instanceof Error) {
    return (
      <span role="alert" className="text-xs text-rose-400">
        {error.message}
      </span>
    )
  }
  if (!saved) return null
  if (saved.reloadRequired) return <span className="text-xs text-amber-400">Enregistré : redémarrage du daemon requis.</span>
  return <span className="text-xs text-emerald-400">{saved.changed ? 'Enregistré.' : 'Déjà à jour, rien n’a été réécrit.'}</span>
}
