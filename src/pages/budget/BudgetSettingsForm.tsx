import { INPUT as BASE_INPUT } from '../../components/ui/classes'
import { useState, type FormEvent } from 'react'
import { fieldErrors } from '../../api/send'
import { ROUTES, type BudgetSettings, type BudgetUpdate, type PerTicketBudget } from '../../api/types/budget'
import { SaveStatus } from '../../components/SaveStatus'
import { fromMillions, toMillions, useSaveBudget } from './queries'

const INPUT = `${BASE_INPUT} w-24 text-right tabular-nums`
const CEILING_KEYS = [...ROUTES, 'default'] as const
const NOT_A_NUMBER = 'nombre attendu'

function Errors({ messages }: { messages: string[] }) {
  return messages.length === 0 ? null : (
    <span role="alert" className="text-xs text-rose-400">
      {messages.join(' ; ')}
    </span>
  )
}

/** `12,5` or `12.5` as a number; `undefined` for an empty text, `NaN` for a text that is not a number. */
function readNumber(text: string): number | undefined {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed.replace(',', '.'))
}

/**
 * Edits the ceilings per route (millions of tokens), the Pixellab guard, the dispatcher slots, night mode
 * and the 7 d stop. It sends only those keys: the daemon merges them into `TODO/config.yaml`.
 */
export function BudgetSettingsForm({ settings }: { settings: BudgetSettings }) {
  const save = useSaveBudget()
  const { budget, dispatcher } = settings
  const [ceilings, setCeilings] = useState<Record<keyof PerTicketBudget, string>>(
    () => Object.fromEntries(CEILING_KEYS.map((key) => [key, toMillions(budget.per_ticket[key])])) as Record<keyof PerTicketBudget, string>,
  )
  const [minReserve, setMinReserve] = useState(String(budget.pixellab.min_reserve))
  const [generations, setGenerations] = useState(String(budget.pixellab.per_ticket))
  const [slots, setSlots] = useState(String(dispatcher.slots))
  const testSlotsKnown = dispatcher.test_slots !== undefined
  const [testSlots, setTestSlots] = useState(testSlotsKnown ? String(dispatcher.test_slots) : '')
  const [night, setNight] = useState(dispatcher.night)
  const [windowMinutes, setWindowMinutes] = useState(String(dispatcher.night.heavy_window_minutes))
  const [stop, setStop] = useState(dispatcher.stop_at_7d_percent === null ? '' : String(dispatcher.stop_at_7d_percent))
  const [local, setLocal] = useState<Record<string, string>>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems: Record<string, string> = {}
    const number = (path: string, text: string): number | undefined => {
      const value = readNumber(text)
      if (value !== undefined && !Number.isFinite(value)) problems[path] = NOT_A_NUMBER
      return value
    }
    const perTicket: Partial<PerTicketBudget> = {}
    for (const key of CEILING_KEYS) {
      const tokens = fromMillions(ceilings[key])
      if (ceilings[key].trim() !== '' && tokens === undefined) problems[`budget.per_ticket.${key}`] = NOT_A_NUMBER
      if (tokens !== undefined) perTicket[key] = tokens
    }
    const pixellab: NonNullable<BudgetUpdate['budget']>['pixellab'] = {}
    const reserve = number('budget.pixellab.min_reserve', minReserve)
    const perIssue = number('budget.pixellab.per_ticket', generations)
    if (reserve !== undefined) pixellab.min_reserve = reserve
    if (perIssue !== undefined) pixellab.per_ticket = perIssue
    const slotCount = number('dispatcher.slots', slots)
    const testSlotCount = testSlotsKnown ? number('dispatcher.test_slots', testSlots) : undefined
    const stopPercent = number('dispatcher.stop_at_7d_percent', stop)
    const heavyWindow = number('dispatcher.night.heavy_window_minutes', windowMinutes)
    setLocal(problems)
    if (Object.keys(problems).length > 0) return
    save.mutate({
      budget: { per_ticket: perTicket, pixellab },
      dispatcher: {
        ...(slotCount === undefined ? {} : { slots: slotCount }),
        ...(testSlotCount === undefined ? {} : { test_slots: testSlotCount }),
        stop_at_7d_percent: stopPercent ?? null,
        night: { ...night, ...(heavyWindow === undefined ? {} : { heavy_window_minutes: heavyWindow }) },
      },
    })
  }

  const errors = (path: string): string[] => [...fieldErrors(save.error, path), ...(local[path] === undefined ? [] : [local[path]])]
  const patchNight = (patch: Partial<typeof night>) => setNight((current) => ({ ...current, ...patch }))

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Plafonds et planification">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-ink-muted">Plafond par issue (millions de tokens, 0 = sans plafond)</legend>
        {CEILING_KEYS.map((key) => (
          <label key={key} className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-ink-soft">{key}</span>
            <input
              className={INPUT}
              inputMode="decimal"
              value={ceilings[key]}
              onChange={(event) => setCeilings((current) => ({ ...current, [key]: event.target.value }))}
              aria-label={`Plafond ${key}`}
            />
            <Errors messages={errors(`budget.per_ticket.${key}`)} />
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-ink-muted">Crédits Pixellab</legend>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-40 text-ink-soft">Réserve minimale</span>
          <input className={INPUT} inputMode="decimal" value={minReserve} onChange={(event) => setMinReserve(event.target.value)} aria-label="Réserve Pixellab" />
          <Errors messages={errors('budget.pixellab.min_reserve')} />
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-40 text-ink-soft">Générations par issue</span>
          <input className={INPUT} inputMode="numeric" value={generations} onChange={(event) => setGenerations(event.target.value)} aria-label="Générations Pixellab par issue" />
          <Errors messages={errors('budget.pixellab.per_ticket')} />
        </label>
      </fieldset>
      <label className="flex flex-wrap items-center gap-2">
        <span className="w-40 text-ink-soft">Places de dev</span>
        <input className={INPUT} inputMode="numeric" value={slots} onChange={(event) => setSlots(event.target.value)} aria-label="Places de dev" />
        <Errors messages={errors('dispatcher.slots')} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="w-40 text-ink-soft">Places de test</span>
        <input
          className={INPUT}
          inputMode="numeric"
          value={testSlotsKnown ? testSlots : ''}
          placeholder={testSlotsKnown ? undefined : 'non communiqué'}
          readOnly={!testSlotsKnown}
          onChange={(event) => setTestSlots(event.target.value)}
          aria-label="Places de test"
        />
        <Errors messages={errors('dispatcher.test_slots')} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-ink-muted">Mode nuit</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={night.enabled} onChange={(event) => patchNight({ enabled: event.target.checked })} />
          Mode nuit (runs lourds dans la fenêtre de nuit)
          <Errors messages={errors('dispatcher.night.enabled')} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            De
            <input className={INPUT} value={night.start} onChange={(event) => patchNight({ start: event.target.value })} aria-label="Début de nuit" placeholder="22:00" />
          </label>
          <label className="flex items-center gap-1">
            à
            <input className={INPUT} value={night.end} onChange={(event) => patchNight({ end: event.target.value })} aria-label="Fin de nuit" placeholder="07:00" />
          </label>
          <Errors messages={[...errors('dispatcher.night.start'), ...errors('dispatcher.night.end')]} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={night.heavy_after_reset} onChange={(event) => patchNight({ heavy_after_reset: event.target.checked })} />
          Runs lourds seulement juste après un reset de la fenêtre 5 h
          <Errors messages={errors('dispatcher.night.heavy_after_reset')} />
        </label>
        <label className="flex flex-wrap items-center gap-2">
          Minutes qui comptent comme « juste après »
          <input className={INPUT} inputMode="numeric" value={windowMinutes} onChange={(event) => setWindowMinutes(event.target.value)} aria-label="Minutes après reset" />
          <Errors messages={errors('dispatcher.night.heavy_window_minutes')} />
        </label>
      </fieldset>
      <label className="flex flex-wrap items-center gap-2">
        Arrêt à
        <input className={INPUT} inputMode="decimal" value={stop} onChange={(event) => setStop(event.target.value)} aria-label="Seuil 7 j" />
        % de la fenêtre 7 j (vide = pas d’arrêt)
        <Errors messages={errors('dispatcher.stop_at_7d_percent')} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-accent-strong px-3 py-1.5 font-medium text-white hover:bg-accent disabled:opacity-50" disabled={save.isPending}>
          Enregistrer
        </button>
        <SaveStatus error={save.error} saved={save.data} />
      </div>
    </form>
  )
}
