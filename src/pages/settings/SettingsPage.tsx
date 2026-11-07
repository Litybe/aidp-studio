import { memo, useState } from 'react'
import { clearToken } from '../../api/auth'
import { useGatewayStatus, useProjects } from '../../api/queries'
import type { GatewayStatus } from '../../api/types'
import type { ModelsSettings, RoutingSettings } from '../../api/types/settings'
import { Async } from '../../components/Async'
import { formatDateTime } from '../../lib/format'
import { sinceDate, USAGE_DAYS, useUsage } from '../budget/queries'
import { ModelsForm } from './ModelsForm'
import { useCatalogFlows, useCatalogTemplates, useModels, useRouting, useSlots } from './queries'
import { RoutingForm } from './RoutingForm'

const CARD = 'rounded border border-slate-800 bg-slate-900/40 p-4'
const H2 = 'mb-2 text-sm font-semibold text-slate-100'

const RoutingCard = memo(function RoutingCard() {
  const query = useRouting()
  return (
    <section className={CARD} aria-label="Routage">
      <h2 className={H2}>Routage labels vers flow</h2>
      <Async query={query} what="Routage">
        {(settings: RoutingSettings) => <RoutingForm settings={settings} />}
      </Async>
    </section>
  )
})

/** Mean tokens per session of each stage, for the model table (empty until `groupBy=stage` exists). */
function useStageAverages(from: string): ReadonlyMap<string, number> {
  const usage = useUsage('stage', from)
  const averages = new Map<string, number>()
  for (const bucket of usage.data?.buckets ?? []) if (bucket.sessions > 0) averages.set(bucket.key, bucket.totalTokens / bucket.sessions)
  return averages
}

const ModelsCard = memo(function ModelsCard({ from }: { from: string }) {
  const query = useModels()
  const averages = useStageAverages(from)
  return (
    <section className={CARD} aria-label="Modèles">
      <h2 className={H2}>Politique de modèles (route x stage)</h2>
      <Async query={query} what="Politique de modèles">
        {(settings: ModelsSettings) => <ModelsForm settings={settings} averages={averages} />}
      </Async>
    </section>
  )
})

const SlotsCard = memo(function SlotsCard() {
  const query = useSlots()
  return (
    <section className={CARD} aria-label="Slots">
      <h2 className={H2}>Slots du dispatcher</h2>
      <Async query={query} what="Slots">
        {(slots) => <p>{slots ? `${slots.used} utilisés sur ${slots.max}` : 'non communiqués par le daemon'}</p>}
      </Async>
    </section>
  )
})

const selectDaemon = (status: GatewayStatus) => ({
  vault: status.vault,
  stateDir: status.stateDir,
  skillRoot: status.skillRoot,
  startedAt: status.startedAt,
})

const ProjectCard = memo(function ProjectCard() {
  const daemon = useGatewayStatus(selectDaemon).data
  const projects = useProjects().data
  return (
    <section className={CARD} aria-label="Projet">
      <h2 className={H2}>Projet et chemins</h2>
      {daemon ? (
        <dl className="grid grid-cols-[9rem_1fr] gap-y-0.5 break-all">
          <dt className="text-slate-400">Vault</dt>
          <dd>{daemon.vault ?? 'désactivé'}</dd>
          <dt className="text-slate-400">État du daemon</dt>
          <dd>{daemon.stateDir}</dd>
          <dt className="text-slate-400">Skill</dt>
          <dd>{daemon.skillRoot ?? '—'}</dd>
          <dt className="text-slate-400">Démarré</dt>
          <dd>{formatDateTime(daemon.startedAt)}</dd>
        </dl>
      ) : null}
      {projects && projects.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs">
          {projects.map((project) => (
            <li key={project.id}>
              <span className="text-slate-200">{project.name}</span> <span className="text-slate-500 break-all">{project.path}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
})

const CatalogCard = memo(function CatalogCard() {
  const flows = useCatalogFlows()
  const templates = useCatalogTemplates()
  return (
    <section className={CARD} aria-label="Catalogues">
      <h2 className={H2}>Catalogues</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs text-slate-400">Flows</h3>
          <Async query={flows} what="Catalogue des flows">
            {(items) => (
              <ul className="flex flex-col gap-0.5 text-xs">
                {items.map((flow) => (
                  <li key={flow.id} title={flow.description}>
                    {flow.name ?? flow.id}
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>
        <div>
          <h3 className="mb-1 text-xs text-slate-400">Templates</h3>
          <Async query={templates} what="Catalogue des templates">
            {(items) => (
              <ul className="flex flex-col gap-0.5 text-xs">
                {items.map((template) => (
                  <li key={template.id}>
                    {template.id}
                    {template.stageCount !== undefined ? <span className="text-slate-500"> · {template.stageCount} stages</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>
      </div>
    </section>
  )
})

function LogoutCard() {
  return (
    <section className={CARD} aria-label="Connexion">
      <h2 className="mb-2 font-semibold text-slate-100">Connexion</h2>
      <button
        type="button"
        className="min-h-11 rounded border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
        onClick={clearToken}
      >
        Se déconnecter
      </button>
    </section>
  )
}

export default function SettingsPage() {
  const [from] = useState(() => sinceDate(USAGE_DAYS, Date.now()))
  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-100">Réglages</h1>
      <RoutingCard />
      <ModelsCard from={from} />
      <SlotsCard />
      <ProjectCard />
      <CatalogCard />
      <LogoutCard />
    </section>
  )
}
