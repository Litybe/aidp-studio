import { useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import type { Ticket } from '../../api/types'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { SELECT } from '../../components/ui/classes'
import { forceTargetsFor, ticketNumber, type ForceTarget } from './columns'

const FORCE_REASON = 'forcée depuis le front'

/** Moves a stuck ticket to any column by hand: the daemon skips the steps before it. */
export function ForceMove({ ticket }: { ticket: Ticket }) {
  const [target, setTarget] = useState<ForceTarget | ''>('')
  const force = useApiAction((chosen: ForceTarget) =>
    apiPost(routes.ticketForce(ticket.key), { target: chosen, reason: FORCE_REASON }),
  )
  const options = forceTargetsFor(ticket)
  const chosen = options.find((option) => option.id === target)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        aria-label={`Forcer ${ticketNumber(ticket)} vers`}
        className={`${SELECT} py-1 text-xs max-sm:min-h-10`}
        value={target}
        onChange={(event) => setTarget(event.target.value as ForceTarget | '')}
      >
        <option value="">Forcer vers…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {chosen ? (
        <ActionButton
          label="Forcer"
          tone="danger"
          icon="arrowUp"
          confirm={`Forcer ${ticketNumber(ticket)} vers ${chosen.label} ? Les étapes d'avant sont sautées.`}
          onRun={() => force.run(chosen.id)}
        />
      ) : null}
      <FeedbackLine feedback={force.feedback} />
    </span>
  )
}
