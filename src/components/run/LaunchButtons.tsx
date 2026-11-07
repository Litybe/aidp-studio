import { lazy, Suspense, useState } from 'react'
import type { Ticket } from '../../api/types'

const TicketRunDialog = lazy(() => import('./TicketRunDialog'))
const GlobalRunDialog = lazy(() => import('./GlobalRunDialog'))

const BUTTON = 'rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800'

/** « Lancer… » on an issue: opens the run dialog (loaded on first use). */
export function LaunchRunButton({ ticket, label = 'Lancer…' }: { ticket: Ticket; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={BUTTON} onClick={() => setOpen(true)}>
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

/** « Nouveau run » of the top bar. */
export function NewRunButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={BUTTON} onClick={() => setOpen(true)}>
        Nouveau run
      </button>
      {open ? (
        <Suspense fallback={null}>
          <GlobalRunDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
