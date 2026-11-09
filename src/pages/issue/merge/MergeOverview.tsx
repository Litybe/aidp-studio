import { useMemo } from 'react'
import type { FlowRun, Ticket } from '../../../api/types'
import { useTicketPr } from '../../../api/f1queries'
import { ROUTE_ICON, routeOf } from '../../board/columns'
import { runIdsOf } from '../flowTimeline'
import { CodeChanges } from './CodeChanges'
import { buildRows, parseCriteria } from './criteria'
import { CriteriaSummary, CriteriaTable } from './CriteriaTable'
import { FinalResult } from './FinalResult'
import { usePrFiles, useCriteriaResults } from './queries'

/** The ticket waits for the merge decision: the human step `merge_approval` is the current one. */
export function isMergePending(flow: FlowRun | undefined): boolean {
  return Boolean(flow && flow.current === 'merge_approval' && flow.steps['merge_approval']?.status === 'waiting_human')
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-ink">
        {title}
        {hint ? <span className="text-xs font-normal text-ink-faint">{hint}</span> : null}
      </h2>
      {children}
    </section>
  )
}

interface Props {
  ticket: Ticket
  flow: FlowRun
  body: string
}

/**
 * What the merge decision needs, in one screen: the final result kept at the head of the PR (art and
 * map) or the code of the PR (code), then each acceptance criterion with its result.
 */
export function MergeOverview({ ticket, flow, body }: Props) {
  const route = routeOf(ticket)
  const visual = route === 'art' || route === 'map'
  const prStatus = useTicketPr(ticket.key, true)
  const repo = prStatus.data?.repo ?? flow.pr?.repository ?? undefined
  const number = prStatus.data?.number ?? flow.pr?.number
  const sha = prStatus.data?.head?.sha
  const files = usePrFiles(repo, number, sha)
  const runIds = useMemo(() => runIdsOf(flow), [flow])
  const { results, sources, pending } = useCriteriaResults(flow)
  const rows = useMemo(() => buildRows(parseCriteria(body), results), [body, results])

  let main: React.ReactNode
  if (prStatus.isPending) main = <p className="text-sm text-ink-faint">Chargement de la PR…</p>
  else if (!repo || !number || !sha) {
    main = <p className="text-sm text-rose-400">PR introuvable : le daemon n'a pas donné sa tête (dépôt, numéro, SHA).</p>
  } else if (files.isPending) main = <p className="text-sm text-ink-faint">Chargement des fichiers de la PR…</p>
  else if (files.isError) main = <p className="text-sm text-rose-400">Fichiers de la PR illisibles : {files.error.message}</p>
  else if (visual) main = <FinalResult repo={repo} sha={sha} files={files.data.files} runIds={runIds} />
  else main = <CodeChanges files={files.data.files} hasMore={files.data.hasMore} repo={repo} number={number} sha={sha} />

  return (
    <div className="space-y-5" data-testid="merge-overview">
      <p className="rounded-md border border-line bg-card px-3 py-2 text-sm">
        <span className="mr-3 font-medium text-ink-soft">{ROUTE_ICON[route].label}</span>
        <CriteriaSummary rows={rows} />
      </p>
      <Section
        title={visual ? 'Résultat final' : 'Code'}
        {...(sha ? { hint: `tête de la PR ${sha.slice(0, 7)}` } : {})}
      >
        {main}
      </Section>
      <Section
        title="Critères d'acceptation"
        hint={pending ? 'lecture des résultats…' : sources === 0 ? 'aucun résultat de stage trouvé' : `${sources} fichier${sources > 1 ? 's' : ''} de résultats`}
      >
        <CriteriaTable rows={rows} />
      </Section>
    </div>
  )
}
