import type { ReactNode } from 'react'
import { ApiValidationError } from '../../api/send'
import { ApiError } from '../../api/client'
import { isMissing } from '../../api/send'
import { BUTTON, BUTTON_PRIMARY, INPUT as BASE_INPUT } from '../ui/classes'

export const INPUT = `${BASE_INPUT} w-full text-xs`

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-ink-muted">
      <span>
        {label}
        {required ? <span className="text-amber-400"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

/** A 400 / 409 (or any failure) of the start route, shown inside the dialog. */
export function StartError({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null
  if (isMissing(error)) return <p className="text-xs text-ink-faint" data-testid="soon">Lancement manuel : bientôt disponible</p>
  const lines: string[] = []
  if (error instanceof ApiValidationError) {
    lines.push(error.message, ...error.general, ...error.fields.map((f) => `${f.path} : ${f.message}`))
  } else if (error instanceof ApiError || error instanceof Error) {
    lines.push(error.message)
  }
  return (
    <div className="space-y-0.5 rounded-md border border-rose-900/60 bg-rose-950/30 p-2 text-xs text-rose-300" role="alert">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  )
}

export function Buttons({ pending, submitLabel, onCancel, disabled }: { pending: boolean; submitLabel: string; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" className={BUTTON} onClick={onCancel}>
        Annuler
      </button>
      <button type="submit" disabled={pending || disabled} className={BUTTON_PRIMARY}>
        {pending ? 'Envoi…' : submitLabel}
      </button>
    </div>
  )
}
