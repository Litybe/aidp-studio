import { useState, type FormEvent } from 'react'
import { ApiValidationError, fieldErrors } from '../../api/send'
import type { RoutingRepo, RoutingRule, RoutingSettings } from '../../api/types/settings'
import { useSaveSetting } from './queries'

const INPUT = 'rounded border border-slate-700 bg-slate-950 px-2 py-1'
const BUTTON = 'rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800'

function Errors({ messages }: { messages: string[] }) {
  return messages.length === 0 ? null : (
    <span role="alert" className="text-xs text-rose-400">
      {messages.join(' ; ')}
    </span>
  )
}

/** Save status shared by the three forms of the page. */
export function SaveStatus({ error, success }: { error: unknown; success: boolean }) {
  if (error instanceof ApiValidationError) {
    const text = [error.message, ...error.general].join(' ; ')
    return (
      <span role="alert" className="text-xs text-rose-400">
        {text}
      </span>
    )
  }
  if (error instanceof Error) {
    return (
      <span role="alert" className="text-xs text-rose-400">
        {error.message}
      </span>
    )
  }
  return success ? <span className="text-xs text-emerald-400">Enregistré.</span> : null
}

const REPO_FIELDS = ['flow', 'template', 'track'] as const

/** Labels to flow rules, per-repository flow/template/track, default track. */
export function RoutingForm({ settings }: { settings: RoutingSettings }) {
  const save = useSaveSetting<RoutingSettings>('routing')
  const [track, setTrack] = useState(settings.defaults?.track ?? '')
  const [rules, setRules] = useState<RoutingRule[]>(() => (settings.rules ?? []).map((rule) => ({ ...rule, match: { ...rule.match } })))
  const [repos, setRepos] = useState<Record<string, RoutingRepo>>(() => structuredClone(settings.repos ?? {}))

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: RoutingSettings = { ...settings, rules, repos }
    next.defaults = { ...settings.defaults, ...(track.trim() === '' ? {} : { track }) }
    if (track.trim() === '') delete next.defaults.track
    save.mutate(next)
  }

  const setRule = (index: number, patch: (rule: RoutingRule) => RoutingRule) =>
    setRules((current) => current.map((rule, at) => (at === index ? patch(rule) : rule)))

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Routage">
      <label className="flex flex-wrap items-center gap-2">
        <span className="w-32 text-slate-400">Track par défaut</span>
        <input className={INPUT} value={track} onChange={(event) => setTrack(event.target.value)} aria-label="Track par défaut" />
        <Errors messages={fieldErrors(save.error, 'defaults.track')} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-slate-400">Labels vers service</legend>
        {rules.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              className={INPUT}
              value={rule.match.label}
              onChange={(event) => setRule(index, (current) => ({ ...current, match: { ...current.match, label: event.target.value } }))}
              aria-label={`Label ${index + 1}`}
              placeholder="aidp:art"
            />
            <span aria-hidden="true">vers</span>
            <input
              className={INPUT}
              value={rule.service}
              onChange={(event) => setRule(index, (current) => ({ ...current, service: event.target.value }))}
              aria-label={`Service ${index + 1}`}
              placeholder="art"
            />
            <button type="button" className={BUTTON} onClick={() => setRules((current) => current.filter((_, at) => at !== index))}>
              Retirer
            </button>
            <Errors messages={[...fieldErrors(save.error, `rules.${index}.match.label`), ...fieldErrors(save.error, `rules.${index}.service`), ...fieldErrors(save.error, `rules.${index}`)]} />
          </div>
        ))}
        <div>
          <button type="button" className={BUTTON} onClick={() => setRules((current) => [...current, { match: { label: '' }, service: '' }])}>
            Ajouter une règle
          </button>
        </div>
        <Errors messages={fieldErrors(save.error, 'rules')} />
      </fieldset>
      {Object.keys(repos).length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs text-slate-400">Dépôts</legend>
          {Object.entries(repos).map(([name, repo]) => (
            <div key={name} className="flex flex-wrap items-center gap-2">
              <span className="w-32 truncate text-slate-300" title={name}>
                {name}
              </span>
              {REPO_FIELDS.map((field) => (
                <input
                  key={field}
                  className={`${INPUT} w-36`}
                  value={repo[field] ?? ''}
                  placeholder={field}
                  aria-label={`${name} ${field}`}
                  onChange={(event) => {
                    const value = event.target.value
                    setRepos((current) => {
                      const entry: RoutingRepo = { ...current[name] }
                      if (value === '') delete entry[field]
                      else entry[field] = value
                      return { ...current, [name]: entry }
                    })
                  }}
                />
              ))}
              <Errors messages={REPO_FIELDS.flatMap((field) => fieldErrors(save.error, `repos.${name}.${field}`))} />
            </div>
          ))}
        </fieldset>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-50" disabled={save.isPending}>
          Enregistrer le routage
        </button>
        <SaveStatus error={save.error} success={save.isSuccess} />
      </div>
    </form>
  )
}
