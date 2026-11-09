import { useState, type FormEvent } from 'react'
import { fieldErrors } from '../../api/send'
import { ROUTES } from '../../api/types/budget'
import { MODEL_IDS, STAGE_IDS, type ModelPolicy, type ModelsSettings } from '../../api/types/settings'
import { formatTokens } from '../../components/BarChart'
import { SaveStatus } from '../../components/SaveStatus'
import { useSaveModels } from './queries'

/** Without an entry the template's own model applies. */
const DEFAULT_CHOICE = ''

/** Drops empty choices and routes left empty before the table goes to the daemon. */
export function cleanModels(models: ModelPolicy): ModelPolicy {
  const out: ModelPolicy = {}
  for (const [route, stages] of Object.entries(models)) {
    const kept = Object.fromEntries(Object.entries(stages).filter(([, model]) => model !== DEFAULT_CHOICE))
    if (Object.keys(kept).length > 0) out[route] = kept
  }
  return out
}

/** The usual stage ids first, then the ones the policy names that the daemon does not list. */
function stageRows(settings: ModelsSettings): string[] {
  const usual = settings.stages.length > 0 ? settings.stages : [...STAGE_IDS]
  const extra = new Set(Object.values(settings.models).flatMap((stages) => Object.keys(stages)))
  for (const stage of usual) extra.delete(stage)
  return [...usual, ...extra]
}

/** Model policy route x stage (C5, T5). `averages` is the mean tokens per session of each stage, to decide downgrades. */
export function ModelsForm({ settings, averages }: { settings: ModelsSettings; averages: ReadonlyMap<string, number> }) {
  const save = useSaveModels()
  const [models, setModels] = useState<ModelPolicy>(() => structuredClone(settings.models))
  const routes = settings.routes.length > 0 ? settings.routes : [...ROUTES]
  const tiers = settings.tiers.length > 0 ? settings.tiers : [...MODEL_IDS]

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ models: cleanModels(models) })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Politique de modèles">
      <div className="overflow-auto">
        <table className="text-left text-xs">
          <thead className="text-ink-muted">
            <tr>
              <th className="pr-3 font-normal">Stage</th>
              {routes.map((route) => (
                <th key={route} className="pr-2 font-normal">
                  {route}
                </th>
              ))}
              <th className="pl-2 text-right font-normal">Moy. tokens / session</th>
            </tr>
          </thead>
          <tbody>
            {stageRows(settings).map((stage) => (
              <tr key={stage}>
                <td className="pr-3 text-ink-soft">{stage}</td>
                {routes.map((route) => {
                  const errors = fieldErrors(save.error, `models.${route}.${stage}`)
                  return (
                    <td key={route} className="pr-2 py-0.5">
                      <select
                        className="rounded border border-line-strong bg-canvas px-1 py-0.5"
                        aria-label={`${route} ${stage}`}
                        aria-invalid={errors.length > 0}
                        title={errors.join(' ; ')}
                        value={models[route]?.[stage] ?? DEFAULT_CHOICE}
                        onChange={(event) => {
                          const value = event.target.value
                          setModels((current) => ({ ...current, [route]: { ...current[route], [stage]: value } }))
                        }}
                      >
                        <option value={DEFAULT_CHOICE}>défaut</option>
                        {tiers.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      {errors.length > 0 ? (
                        <span role="alert" className="ml-1 text-rose-400">
                          {errors.join(' ; ')}
                        </span>
                      ) : null}
                    </td>
                  )
                })}
                <td className="pl-2 text-right tabular-nums text-ink-muted">{averages.has(stage) ? formatTokens(averages.get(stage) ?? 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-accent-strong px-3 py-1.5 font-medium text-white hover:bg-accent disabled:opacity-50" disabled={save.isPending}>
          Enregistrer les modèles
        </button>
        <SaveStatus error={save.error} saved={save.data} />
      </div>
    </form>
  )
}
