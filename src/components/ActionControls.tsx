import { memo, useState } from 'react'
import type { ActionFeedback } from '../api/actions'

const BASE =
  'rounded border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const TONES = {
  neutral: 'border-slate-700 text-slate-300 hover:bg-slate-800',
  primary: 'border-sky-700 bg-sky-900/40 text-sky-200 hover:bg-sky-800/60',
  danger: 'border-red-800 text-red-300 hover:bg-red-950',
} as const

export type Tone = keyof typeof TONES

interface ActionButtonProps {
  label: string
  onRun: () => void
  /** A destructive action asks "Oui, confirmer" before it runs. */
  confirm?: string
  disabled?: boolean
  tone?: Tone
}

/** A daemon action button; with `confirm`, the click first shows the question inline. */
export const ActionButton = memo(function ActionButton({
  label,
  onRun,
  confirm,
  disabled = false,
  tone = 'neutral',
}: ActionButtonProps) {
  const [asking, setAsking] = useState(false)
  if (asking && confirm) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-300" role="alert">
        {confirm}
        <button
          type="button"
          className={`${BASE} ${TONES.danger}`}
          onClick={() => {
            setAsking(false)
            onRun()
          }}
        >
          Oui, confirmer
        </button>
        <button type="button" className={`${BASE} ${TONES.neutral}`} onClick={() => setAsking(false)}>
          Non
        </button>
      </span>
    )
  }
  return (
    <button
      type="button"
      className={`${BASE} ${TONES[tone]}`}
      disabled={disabled}
      onClick={() => (confirm ? setAsking(true) : onRun())}
    >
      {label}
    </button>
  )
})

/** The route does not exist in the daemon yet (C11): a quiet note, never an error. */
export function Soon({ what }: { what?: string }) {
  return (
    <span className="text-xs text-slate-500" data-testid="soon">
      {what ? `${what} : ` : ''}bientôt disponible
    </span>
  )
}

/** What happened to the last action: nothing while idle. */
export function FeedbackLine({ feedback }: { feedback: ActionFeedback }) {
  if (feedback.soon) return <Soon />
  if (feedback.error) {
    return (
      <p className="text-xs text-red-400" role="status">
        {feedback.error}
      </p>
    )
  }
  if (feedback.pending) return <p className="text-xs text-slate-500">en cours…</p>
  return null
}
