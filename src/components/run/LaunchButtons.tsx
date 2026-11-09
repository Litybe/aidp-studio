import { lazy, Suspense, useState } from 'react'
import type { Ticket } from '../../api/types'
import { BUTTON, BUTTON_PRIMARY } from '../ui/classes'
import { Icon } from '../ui/Icon'

const TicketRunDialog = lazy(() => import('./TicketRunDialog'))
const GlobalRunDialog = lazy(() => import('./GlobalRunDialog'))

/** « Lancer… » on an issue: opens the run dialog (loaded on first use). */
export function LaunchRunButton({ ticket, label = 'Lancer…' }: { ticket: Ticket; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={BUTTON} onClick={() => setOpen(true)}>
        <Icon name="play" size={12} />
        {label}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <TicketRunDialog ticket={ticket} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}

/** « Nouveau run » of the top bar (icon only on the phone). */
export function NewRunButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={compact ? `${BUTTON_PRIMARY} size-9 px-0` : BUTTON_PRIMARY}
        onClick={() => setOpen(true)}
        aria-label={compact ? 'Nouveau run' : undefined}
        title={compact ? 'Nouveau run' : undefined}
      >
        <Icon name="plus" size={14} />
        {compact ? null : 'Nouveau run'}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <GlobalRunDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
