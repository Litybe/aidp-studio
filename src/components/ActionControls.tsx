import { memo, useState } from 'react'
import type { ActionFeedback } from '../api/actions'
import { BUTTON, BUTTON_DANGER, BUTTON_SOFT } from './ui/classes'
import { Icon, type IconName } from './ui/Icon'

const TONES = {
  neutral: BUTTON,
  primary: BUTTON_SOFT,
  danger: BUTTON_DANGER,
} as const

export type Tone = keyof typeof TONES

interface ActionButtonProps {
  label: string
  onRun: () => void
  /** A destructive action asks "Oui, confirmer" before it runs. */
  confirm?: string
  disabled?: boolean
  tone?: Tone
  icon?: IconName
}

/** A daemon action button; with `confirm`, the click first shows the question inline. */
export const ActionButton = memo(function ActionButton({ label, onRun, confirm, disabled = false, tone = 'neutral', icon }: ActionButtonProps) {
  const [asking, setAsking] = useState(false)
  if (asking && confirm) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-amber-900/60 bg-amber-950/30 px-2 py-1 text-xs text-amber-200" role="alert">
        {confirm}
        <button
          type="button"
          className={TONES.danger}
          onClick={() => {
            setAsking(false)
            onRun()
          }}
        >
          Oui, confirmer
        </button>
        <button type="button" className={TONES.neutral} onClick={() => setAsking(false)}>
          Non
        </button>
      </span>
    )
  }
  return (
    <button type="button" className={TONES[tone]} disabled={disabled} onClick={() => (confirm ? setAsking(true) : onRun())}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {label}
    </button>
  )
})

/** The route does not exist in the daemon yet (C11): a quiet note, never an error. */
export function Soon({ what }: { what?: string }) {
  return (
    <span className="text-xs text-ink-faint" data-testid="soon">
      {what ? `${what} : ` : ''}bientôt disponible
    </span>
  )
}

/** What happened to the last action: nothing while idle. */
export function FeedbackLine({ feedback }: { feedback: ActionFeedback }) {
  if (feedback.soon) return <Soon />
  if (feedback.error) {
    return (
      <p className="text-xs text-rose-400" role="status">
        {feedback.error}
      </p>
    )
  }
  if (feedback.pending) return <p className="text-xs text-ink-faint">en cours…</p>
  return null
}
