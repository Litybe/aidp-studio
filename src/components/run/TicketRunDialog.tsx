import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { routes } from '../../api/actions'
import { useDispatcherPaused } from '../../api/queries'
import { apiSend } from '../../api/send'
import type { Ticket } from '../../api/types'
import type { RoutingSettings } from '../../api/types/settings'
import { formatTokens } from '../../lib/format'
import { showToast } from '../../lib/toast'
import { columnOf, routeOf, ticketNumber } from '../../pages/board/columns'
import { useBudgetSettings } from '../../pages/budget/queries'
import { useCatalogFlows, useCatalogTemplates, useRouting } from '../../pages/settings/queries'
import { Buttons, Field, INPUT, StartError } from './fields'
import { Modal } from './Modal'


/** Flow routed to this ticket: its service's entry first, else the first entry of its route. */
export function routedFlow(ticket: Ticket, routing: RoutingSettings | undefined): string {
  const repos = routing?.repos ?? {}
  const direct = ticket.service ? repos[ticket.service]?.flow : undefined
  if (direct) return direct
  const route = routeOf(ticket)
  return Object.values(repos).find((repo) => repo.route === route && repo.flow)?.flow ?? ''
}

export const TEST_FLOWS_LABEL = 'Test Unity (checkout principal, une issue à la fois)'

/** Catalog flows split into the dev ones and the `game-test-*` ones (C13: test lane, main checkout). */
export function splitFlows<T extends { id: string }>(flows: readonly T[]): { dev: T[]; test: T[] } {
  const test = flows.filter((entry) => entry.id.startsWith('game-test-'))
  return { dev: flows.filter((entry) => !entry.id.startsWith('game-test-')), test }
}

export interface StartReply {
  flowKey?: string
  runId?: string
}

/** « Lancer un run… » on one issue: a flow or a pipeline alone, track, force. */
export default function TicketRunDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const navigate = useNavigate()
  const flows = useCatalogFlows().data ?? []
  const templates = useCatalogTemplates().data ?? []
  const { dev: devFlows, test: testFlows } = splitFlows(flows)
  const routing = useRouting().data
  const budget = useBudgetSettings().data
  const paused = useDispatcherPaused()
  const column = columnOf(ticket)
  const notReady = column === 'triage' || column === 'blocked'
  const forced = notReady || paused

  const [mode, setMode] = useState<'flow' | 'template'>('flow')
  const [flowChoice, setFlowChoice] = useState<string | null>(null)
  const [templateChoice, setTemplateChoice] = useState('')
  const [track, setTrack] = useState<'standard' | 'bug'>('standard')
  const [forceChoice, setForceChoice] = useState<boolean | null>(null)

  const flow = flowChoice ?? routedFlow(ticket, routing)
  const template = templateChoice || templates[0]?.id || ''
  const force = forceChoice ?? forced
  const route = routeOf(ticket)
  const cap = budget?.budget.per_ticket[route] || budget?.budget.per_ticket.default || 0

  const start = useMutation({
    retry: false,
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<StartReply | undefined>('POST', routes.ticketStart(ticket.key), body),
    onSuccess: (reply) => {
      showToast(`Run lancé pour ${ticketNumber(ticket)}${reply?.runId ? ` (${reply.runId})` : ''}`)
      onClose()
      void navigate({ to: '/issue/$key', params: { key: reply?.flowKey ?? ticket.key } })
    },
  })
  const target = mode === 'flow' ? flow : template
  const submit = () => {
    const body: Record<string, unknown> = mode === 'flow' ? { flow } : { template }
    body['track'] = track
    if (force) body['force'] = true
    start.mutate(body)
  }

  let why = ''
  if (notReady && paused) why = 'Ticket bloqué ou non prêt, et dispatcher en pause : sans « Forcer », le lancement est refusé.'
  else if (notReady) why = 'Ticket bloqué ou non prêt : sans « Forcer », le lancement est refusé.'
  else if (paused) why = 'Dispatcher en pause : sans « Forcer », le lancement est refusé.'

  return (
    <Modal title={`Lancer un run — ${ticketNumber(ticket)}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (target !== '') submit()
        }}
      >
        <p className="text-xs text-ink-muted">{ticket.summary}</p>
        <fieldset className="flex gap-4 text-xs text-ink-soft">
          <legend className="sr-only">Mode de lancement</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" checked={mode === 'flow'} onChange={() => setMode('flow')} />
            Flow
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" checked={mode === 'template'} onChange={() => setMode('template')} />
            Pipeline seul
          </label>
        </fieldset>
        {mode === 'flow' ? (
          <Field label="Flow" required>
            <select className={INPUT} value={flow} onChange={(event) => setFlowChoice(event.target.value)}>
              <option value="">— choisir —</option>
              {testFlows.length === 0
                ? flows.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name ?? entry.id}
                    </option>
                  ))
                : [
                    ...devFlows.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name ?? entry.id}
                      </option>
                    )),
                    <optgroup key="test-lane" label={TEST_FLOWS_LABEL}>
                      {testFlows.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name ?? entry.id}
                        </option>
                      ))}
                    </optgroup>,
                  ]}
            </select>
          </Field>
        ) : (
          <Field label="Pipeline" required>
            <select className={INPUT} value={template} onChange={(event) => setTemplateChoice(event.target.value)}>
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name ?? entry.id}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Track">
          <select className={INPUT} value={track} onChange={(event) => setTrack(event.target.value as 'standard' | 'bug')}>
            <option value="standard">standard</option>
            <option value="bug">bug</option>
          </select>
        </Field>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={force} onChange={(event) => setForceChoice(event.target.checked)} />
            Forcer
          </label>
          {why ? <p className="text-xs text-amber-400">{why}</p> : null}
        </div>
        {cap > 0 ? (
          <p className="text-xs text-ink-faint">
            Plafond de la route {route} : {formatTokens(cap)} tokens par ticket.
          </p>
        ) : null}
        <StartError error={start.error} />
        <Buttons pending={start.isPending} disabled={target === ''} submitLabel="Lancer" onCancel={onClose} />
      </form>
    </Modal>
  )
}
