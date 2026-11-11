import { INPUT } from '../../components/ui/classes'
import { useState, type FormEvent } from 'react'
import { fieldErrors } from '../../api/send'
import { ROUTES, type Route } from '../../api/types/budget'
import { TRACKS, type RoutingRepo, type RoutingRule, type RoutingSettings, type RuleMatch, type Track } from '../../api/types/settings'
import { SaveStatus } from '../../components/SaveStatus'
import { useCatalogFlows, useCatalogTemplates, useSaveRouting } from './queries'

const BUTTON = 'rounded border border-line-strong px-2 py-1 text-xs hover:bg-raised'
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

const FLOW_ROUTE = /-(code|art|map|doc)$/

/** Route a flow id suggests (`game-art` gives `art`), when it ends with a known route. */
export function inferRoute(flowId: string): Route | undefined {
  const found = FLOW_ROUTE.exec(flowId)?.[1]
  return ROUTES.find((route) => route === found)
}

/** Options of a select fed by the catalog, keeping the stored value even when the catalog does not know it. */
function withCurrent(ids: readonly string[], current: string | undefined): string[] {
  return current !== undefined && current !== '' && !ids.includes(current) ? [...ids, current] : [...ids]
}

interface PickProps {
  label: string
  value: string | undefined
  ids: readonly string[]
  empty: string
  onChange: (value: string) => void
}

function Pick({ label, value, ids, empty, onChange }: PickProps) {
  return (
    <select className={`${INPUT} w-full`} aria-label={label} value={value ?? NONE} onChange={(event) => onChange(event.target.value)}>
      <option value={NONE}>{empty}</option>
      {withCurrent(ids, value).map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  )
}

const TH = 'px-1 py-1 text-left text-xs font-normal text-ink-muted'

/** Labels and keywords to route targets, per-target flow, template, route and track, default track. */
export function RoutingForm({ settings }: { settings: RoutingSettings }) {
  const save = useSaveRouting()
  const flowIds = (useCatalogFlows().data ?? []).map((flow) => flow.id)
  const templateIds = (useCatalogTemplates().data ?? []).map((template) => template.id)
  const [track, setTrack] = useState<string>(settings.defaults.track ?? NONE)
  const [rules, setRules] = useState<RuleDraft[]>(() => settings.rules.map(toDraft))
  const [repos, setRepos] = useState<Record<string, RoutingRepo>>(() => structuredClone(settings.repos))
  const [raw, setRaw] = useState('')
  const [rawError, setRawError] = useState('')
  const [pending, setPending] = useState('')

  const current = (): RoutingSettings => ({ defaults: track === NONE ? {} : { track: track as Track }, rules: rules.map(toRule), repos })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(current())
  }

  const targets = Object.keys(repos)
  const usedFlows = new Set(Object.values(repos).map((repo) => repo.flow))
  const missingFlows = flowIds.filter((id) => !usedFlows.has(id))
  const setRule = (index: number, patch: Partial<RuleDraft>) => setRules((list) => list.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)))
  const setField = (name: string, field: keyof RoutingRepo, value: string) =>
    setRepos((list) => {
      const next: Record<string, unknown> = { ...list[name] }
      if (value === NONE) delete next[field]
      else next[field] = value
      return { ...list, [name]: next as RoutingRepo }
    })

  /** Adds one target per flow (named after it) and, when the flow implies a route, the `aidp:<route>` rule that selects it. */
  function addFlows(ids: string[]) {
    const created: Record<string, RoutingRepo> = {}
    const wanted: RuleDraft[] = []
    for (const id of ids) {
      if (id in repos) continue
      const route = inferRoute(id)
      created[id] = route === undefined ? { flow: id } : { flow: id, route }
      if (route !== undefined) wanted.push({ labels: `aidp:${route}`, keywords: '', service: id, others: {} })
    }
    setRepos((list) => ({ ...list, ...created }))
    setRules((list) => [...list, ...wanted])
    setPending('')
  }

  function applyRaw() {
    try {
      const parsed = JSON.parse(raw) as Partial<RoutingSettings>
      setTrack(parsed.defaults?.track ?? NONE)
      setRules((parsed.rules ?? []).map(toDraft))
      setRepos(parsed.repos ?? {})
      setRawError('')
    } catch (error) {
      setRawError(`JSON invalide : ${error instanceof Error ? error.message : String(error)}`)
    }
  }

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
        <legend className="mb-1 text-xs text-ink-muted">Flows ciblés (flow, template, route, track)</legend>
        {targets.length === 0 ? <p className="text-xs text-ink-faint">Aucune cible : ajoutez les flows connus du daemon.</p> : null}
        {targets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-xs">
              <thead>
                <tr>
                  <th className={TH}>Cible</th>
                  <th className={TH}>Flow</th>
                  <th className={TH}>Template</th>
                  <th className={TH}>Route</th>
                  <th className={TH}>Track</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {Object.entries(repos).map(([name, repo]) => (
                  <tr key={name}>
                    <td className="px-1 py-0.5 text-ink-soft" title={name}>
                      {name}
                    </td>
                    <td className="px-1 py-0.5">
                      <Pick label={`${name} flow`} value={repo.flow} ids={flowIds} empty="flow : aucun" onChange={(value) => setField(name, 'flow', value)} />
                    </td>
                    <td className="px-1 py-0.5">
                      <Pick label={`${name} template`} value={repo.template} ids={templateIds} empty="template : aucun" onChange={(value) => setField(name, 'template', value)} />
                    </td>
                    <td className="px-1 py-0.5">
                      <Pick label={`${name} route`} value={repo.route} ids={ROUTES} empty="route : nom" onChange={(value) => setField(name, 'route', value)} />
                    </td>
                    <td className="px-1 py-0.5">
                      <Pick label={`${name} track`} value={repo.track} ids={TRACKS} empty="track : défaut" onChange={(value) => setField(name, 'track', value)} />
                    </td>
                    <td className="px-1 py-0.5">
                      <button
                        type="button"
                        className={BUTTON}
                        aria-label={`Retirer la cible ${name}`}
                        onClick={() => setRepos((list) => Object.fromEntries(Object.entries(list).filter(([key]) => key !== name)))}
                      >
                        Retirer
                      </button>
                      <Errors messages={['flow', 'template', 'route', 'track'].flatMap((field) => fieldErrors(save.error, `repos.${name}.${field}`))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON} disabled={missingFlows.length === 0} onClick={() => addFlows(missingFlows)}>
            Ajouter tous les flows connus{missingFlows.length > 0 ? ` (${missingFlows.length})` : ''}
          </button>
          <select className={INPUT} aria-label="Flow à ajouter" value={pending} onChange={(event) => setPending(event.target.value)}>
            <option value={NONE}>Choisir un flow…</option>
            {missingFlows.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button type="button" className={BUTTON} disabled={pending === NONE} onClick={() => addFlows([pending])}>
            Ajouter ce flow
          </button>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-ink-muted">Règles (la première qui correspond gagne)</legend>
        {rules.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              className={INPUT}
              value={rule.labels}
              onChange={(event) => setRule(index, { labels: event.target.value })}
              aria-label={`Labels ${index + 1}`}
              placeholder="labels : aidp:art, pixel:*"
            />
            <select
              className={INPUT}
              aria-label={`Label connu ${index + 1}`}
              value={NONE}
              onChange={(event) => {
                const label = event.target.value
                if (label !== NONE && !toList(rule.labels).includes(label)) setRule(index, { labels: [...toList(rule.labels), label].join(', ') })
              }}
            >
              <option value={NONE}>+ label</option>
              {ROUTES.map((route) => (
                <option key={route} value={`aidp:${route}`}>{`aidp:${route}`}</option>
              ))}
            </select>
            <input
              className={INPUT}
              value={rule.keywords}
              onChange={(event) => setRule(index, { keywords: event.target.value })}
              aria-label={`Mots-clés ${index + 1}`}
              placeholder="mots-clés : sprite, tileset"
            />
            <span aria-hidden="true">vers</span>
            <Pick label={`Service ${index + 1}`} value={rule.service} ids={targets} empty="cible…" onChange={(value) => setRule(index, { service: value })} />
            <button type="button" className={BUTTON} onClick={() => setRules((list) => list.filter((_, at) => at !== index))}>
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
          <button type="button" className={BUTTON} onClick={() => setRules((list) => [...list, { labels: '', keywords: '', service: targets[0] ?? '', others: {} }])}>
            Ajouter une règle
          </button>
        </div>
        <Errors messages={fieldErrors(save.error, 'rules')} />
      </fieldset>
      <details
        className="text-xs"
        onToggle={(event) => {
          if (event.currentTarget.open) setRaw(JSON.stringify(current(), null, 2))
        }}
      >
        <summary className="cursor-pointer text-ink-muted">Édition avancée (JSON brut)</summary>
        <textarea className={`${INPUT} mt-1 h-48 w-full font-mono`} aria-label="Routage JSON" value={raw} onChange={(event) => setRaw(event.target.value)} />
        <div className="mt-1 flex items-center gap-2">
          <button type="button" className={BUTTON} onClick={applyRaw}>
            Appliquer au formulaire
          </button>
          {rawError === '' ? null : (
            <span role="alert" className="text-rose-400">
              {rawError}
            </span>
          )}
        </div>
      </details>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-accent-strong px-3 py-1.5 font-medium text-white hover:bg-accent disabled:opacity-50" disabled={save.isPending}>
          Enregistrer le routage
        </button>
        <SaveStatus error={save.error} saved={save.data} />
      </div>
    </form>
  )
}
