import { useState, type FormEvent } from 'react'
import { ApiValidationError, fieldErrors } from '../../api/send'
import { ROUTES, type BudgetSettings, type Route } from '../../api/types/budget'
import { fromMillions, toMillions, useSaveBudget } from './queries'

const INPUT = 'w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right tabular-nums'

function Errors({ messages }: { messages: string[] }) {
  return messages.length === 0 ? null : (
    <span role="alert" className="text-xs text-rose-400">
      {messages.join(' ; ')}
    </span>
  )
}

/** Edits the ceilings per route (millions of tokens), night mode and the 7 d stop; unknown keys travel back untouched. */
export function BudgetSettingsForm({ settings }: { settings: BudgetSettings }) {
  const save = useSaveBudget()
  const [perTicket, setPerTicket] = useState<Record<Route, string>>(
    () => Object.fromEntries(ROUTES.map((route) => [route, toMillions(settings.per_ticket?.[route])])) as Record<Route, string>,
  )
  const [night, setNight] = useState(settings.night_mode === true)
  const [stop, setStop] = useState(settings.stop_7d === undefined ? '' : String(Math.round(settings.stop_7d * 100)))

  function submit(event: FormEvent) {
    event.preventDefault()
    const ceilings: Partial<Record<Route, number>> = {}
    for (const route of ROUTES) {
      const tokens = fromMillions(perTicket[route])
      if (tokens !== undefined) ceilings[route] = tokens
    }
    const next: BudgetSettings = { ...settings, per_ticket: ceilings, night_mode: night }
    if (stop.trim() === '') delete next.stop_7d
    else next.stop_7d = Number(stop.replace(',', '.')) / 100
    save.mutate(next)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Plafonds et planification">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-slate-400">Plafond par issue (millions de tokens)</legend>
        {ROUTES.map((route) => (
          <label key={route} className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-slate-300">{route}</span>
            <input
              className={INPUT}
              inputMode="decimal"
              value={perTicket[route]}
              onChange={(event) => setPerTicket((current) => ({ ...current, [route]: event.target.value }))}
              aria-label={`Plafond ${route}`}
            />
            <Errors messages={fieldErrors(save.error, `per_ticket.${route}`)} />
          </label>
        ))}
        <Errors messages={fieldErrors(save.error, 'per_ticket')} />
      </fieldset>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={night} onChange={(event) => setNight(event.target.checked)} />
        Mode nuit (runs lourds juste après un reset de la fenêtre 5 h)
        <Errors messages={fieldErrors(save.error, 'night_mode')} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        Arrêt à
        <input className={INPUT} inputMode="decimal" value={stop} onChange={(event) => setStop(event.target.value)} aria-label="Seuil 7 j" />
        % de la fenêtre 7 j
        <Errors messages={fieldErrors(save.error, 'stop_7d')} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-50" disabled={save.isPending}>
          Enregistrer
        </button>
        {save.isSuccess ? <span className="text-xs text-emerald-400">Enregistré.</span> : null}
        {save.error instanceof ApiValidationError ? (
          <span role="alert" className="text-xs text-rose-400">
            {[save.error.message, ...save.error.general].join(' ; ')}
          </span>
        ) : save.isError ? (
          <span role="alert" className="text-xs text-rose-400">
            {save.error.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}
