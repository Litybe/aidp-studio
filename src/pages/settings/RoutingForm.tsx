import { INPUT } from '../../components/ui/classes'
import { useState, type FormEvent } from 'react'
import { fieldErrors } from '../../api/send'
import { ROUTES } from '../../api/types/budget'
import { TRACKS, type RoutingRepo, type RoutingRule, type RoutingSettings, type RuleMatch, type Track } from '../../api/types/settings'
import { SaveStatus } from '../../components/SaveStatus'
import { useSaveRouting } from './queries'

const BUTTON = 'rounded border border-line-strong px-2 py-1 text-xs hover:bg-raised'
const TARGETS_LIST = 'routing-targets'
const NONE = ''

function Errors({ messages }: { messages: string[] }) {
  return messages.length === 0 ? null : (
    <span role="alert" className="text-xs text-rose-400">
      {messages.join(' ; ')}
    </span>
  )
}

/** A rule as the form edits it: the two list criteria as comma-separated texts, the rest kept as it came. */
interface RuleDraft {
  labels: string
  keywords: string
  service: string
  others: RuleMatch
}

const toList = (text: string): string[] =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

function toDraft(rule: RoutingRule): RuleDraft {
  const { label, labels, keywords, ...others } = rule.match
  return { labels: [...(label === undefined ? [] : [label]), ...(labels ?? [])].join(', '), keywords: (keywords ?? []).join(', '), service: rule.service, others }
}

/** The rule the daemon stores: `labels` and `keywords` only when they hold something. */
export function toRule(draft: RuleDraft): RoutingRule {
  const match: RuleMatch = { ...draft.others }
  const labels = toList(draft.labels)
  const keywords = toList(draft.keywords)
  if (labels.length > 0) match.labels = labels
  if (keywords.length > 0) match.keywords = keywords
  return { match, service: draft.service.trim() }
}

const describeOthers = (others: RuleMatch): string =>
  Object.entries(others)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')

const REPO_TEXTS = ['flow', 'template'] as const

/** Labels and keywords to route targets, per-target flow, template, route and track, default track. */
export function RoutingForm({ settings }: { settings: RoutingSettings }) {
  const save = useSaveRouting()
  const [track, setTrack] = useState<string>(settings.defaults.track ?? NONE)
  const [rules, setRules] = useState<RuleDraft[]>(() => settings.rules.map(toDraft))
  const [repos, setRepos] = useState<Record<string, RoutingRepo>>(() => structuredClone(settings.repos))

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ defaults: track === NONE ? {} : { track: track as Track }, rules: rules.map(toRule), repos })
  }

  const setRule = (index: number, patch: Partial<RuleDraft>) => setRules((current) => current.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)))
  const setRepo = (name: string, patch: (repo: RoutingRepo) => RoutingRepo) => setRepos((current) => ({ ...current, [name]: patch(current[name] ?? {}) }))

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Routage">
      <label className="flex flex-wrap items-center gap-2">
        <span className="w-32 text-ink-muted">Track par défaut</span>
        <select className={INPUT} value={track} onChange={(event) => setTrack(event.target.value)} aria-label="Track par défaut">
          <option value={NONE}>aucun</option>
          {TRACKS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Errors messages={fieldErrors(save.error, 'defaults.track')} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-ink-muted">Règles (la première qui correspond gagne)</legend>
        <datalist id={TARGETS_LIST}>
          {Object.keys(repos).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {rules.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              className={INPUT}
              value={rule.labels}
              onChange={(event) => setRule(index, { labels: event.target.value })}
              aria-label={`Labels ${index + 1}`}
              placeholder="labels : aidp:art, pixel:*"
            />
            <input
              className={INPUT}
              value={rule.keywords}
              onChange={(event) => setRule(index, { keywords: event.target.value })}
              aria-label={`Mots-clés ${index + 1}`}
              placeholder="mots-clés : sprite, tileset"
            />
            <span aria-hidden="true">vers</span>
            <input
              className={INPUT}
              list={TARGETS_LIST}
              value={rule.service}
              onChange={(event) => setRule(index, { service: event.target.value })}
              aria-label={`Service ${index + 1}`}
              placeholder="pixelhood-art"
            />
            <button type="button" className={BUTTON} onClick={() => setRules((current) => current.filter((_, at) => at !== index))}>
              Retirer
            </button>
            {Object.keys(rule.others).length > 0 ? <span className="text-xs text-ink-faint">{describeOthers(rule.others)}</span> : null}
            <Errors
              messages={[
                ...fieldErrors(save.error, `rules.${index}.match`),
                ...fieldErrors(save.error, `rules.${index}.match.labels`),
                ...fieldErrors(save.error, `rules.${index}.match.keywords`),
                ...fieldErrors(save.error, `rules.${index}.service`),
                ...fieldErrors(save.error, `rules.${index}.route`),
                ...fieldErrors(save.error, `rules.${index}`),
              ]}
            />
          </div>
        ))}
        <div>
          <button type="button" className={BUTTON} onClick={() => setRules((current) => [...current, { labels: '', keywords: '', service: '', others: {} }])}>
            Ajouter une règle
          </button>
        </div>
        <Errors messages={fieldErrors(save.error, 'rules')} />
      </fieldset>
      {Object.keys(repos).length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs text-ink-muted">Cibles de routage</legend>
          {Object.entries(repos).map(([name, repo]) => (
            <div key={name} className="flex flex-wrap items-center gap-2">
              <span className="w-32 truncate text-ink-soft" title={name}>
                {name}
              </span>
              {REPO_TEXTS.map((field) => (
                <input
                  key={field}
                  className={`${INPUT} w-36`}
                  value={repo[field] ?? ''}
                  placeholder={field}
                  aria-label={`${name} ${field}`}
                  onChange={(event) => {
                    const value = event.target.value
                    setRepo(name, (current) => {
                      const entry: RoutingRepo = { ...current }
                      if (value === '') delete entry[field]
                      else entry[field] = value
                      return entry
                    })
                  }}
                />
              ))}
              <select
                className={INPUT}
                aria-label={`${name} route`}
                value={repo.route ?? NONE}
                onChange={(event) =>
                  setRepo(name, (current) => {
                    const next: RoutingRepo = { ...current }
                    if (event.target.value === NONE) delete next.route
                    else next.route = event.target.value as (typeof ROUTES)[number]
                    return next
                  })
                }
              >
                <option value={NONE}>route : nom</option>
                {ROUTES.map((route) => (
                  <option key={route} value={route}>
                    {route}
                  </option>
                ))}
              </select>
              <select
                className={INPUT}
                aria-label={`${name} track`}
                value={repo.track ?? NONE}
                onChange={(event) =>
                  setRepo(name, (current) => {
                    const next: RoutingRepo = { ...current }
                    if (event.target.value === NONE) delete next.track
                    else next.track = event.target.value as Track
                    return next
                  })
                }
              >
                <option value={NONE}>track : défaut</option>
                {TRACKS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <Errors messages={[...REPO_TEXTS, 'route', 'track'].flatMap((field) => fieldErrors(save.error, `repos.${name}.${field}`))} />
            </div>
          ))}
        </fieldset>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-accent-strong px-3 py-1.5 font-medium text-white hover:bg-accent disabled:opacity-50" disabled={save.isPending}>
          Enregistrer le routage
        </button>
        <SaveStatus error={save.error} saved={save.data} />
      </div>
    </form>
  )
}
