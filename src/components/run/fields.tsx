import type { ReactNode } from 'react'
import { ApiValidationError } from '../../api/send'
import { ApiError } from '../../api/client'
import { isMissing } from '../../api/send'

export const INPUT = 'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100'

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-slate-300">
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
  if (isMissing(error)) return <p className="text-xs text-slate-500" data-testid="soon">Lancement manuel : bientôt disponible</p>
  const lines: string[] = []
  if (error instanceof ApiValidationError) {
    lines.push(error.message, ...error.general, ...error.fields.map((f) => `${f.path} : ${f.message}`))
  } else if (error instanceof ApiError || error instanceof Error) {
    lines.push(error.message)
  }
  return (
    <div className="space-y-0.5 text-xs text-red-400" role="alert">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  )
}

export function Buttons({ pending, submitLabel, onCancel, disabled }: { pending: boolean; submitLabel: string; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800" onClick={onCancel}>
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-800/60 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : submitLabel}
      </button>
    </div>
  )
}
