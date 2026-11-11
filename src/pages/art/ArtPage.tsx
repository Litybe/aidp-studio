import { Link } from '@tanstack/react-router'
import { memo, useDeferredValue, useMemo, useState } from 'react'
import { runFileUrl } from '../../api/actions'
import { useHasToken } from '../../api/auth'
import type { ArtAssetImage, ArtAssetRun } from '../../api/types/art'
import { Async } from '../../components/Async'
import { AuthImage } from '../../components/AuthImage'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pill } from '../../components/ui/Pill'
import type { Tone } from '../../components/ui/classes'
import { formatBytes, formatDateTime } from '../../lib/format'
import { ticketLabel } from '../unity/queries'
import { useArtAssets, useArtTickets, type ArtFilters } from './queries'

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'done', label: 'Terminé' },
  { value: 'failed', label: 'Échoué' },
  { value: 'running', label: 'En cours' },
  { value: 'paused', label: 'En pause' },
  { value: 'cancelled', label: 'Annulé' },
]
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]))
const STATUS_TONE: Record<string, Tone> = { done: 'ok', failed: 'danger', running: 'accent', paused: 'warn', waiting_gate: 'warn', cancelled: 'muted' }
/** Order of the stages in the comparison: brief, then each pass up to the export. */
const STAGE_ORDER = ['brief', 'generate', 'animate', 'fix', 'recheck', 'verify', 'prepare', 'import', 'export']
const NO_ISSUE = ''

const nameOf = (path: string): string => path.split('/').pop() ?? path
const stageRank = (stage: string): number => {
  const index = STAGE_ORDER.indexOf(stage)
  return index === -1 ? STAGE_ORDER.length : index
}

/** Pixel art must stay crisp: no smoothing, lazy decoding, size kept to avoid layout jumps. */
const Picture = memo(function Picture({ runId, image, size }: { runId: string; image: ArtAssetImage; size: number }) {
  // A plain link cannot send the token: with one, the picture is shown without the open-in-tab link.
  const hasToken = useHasToken()
  const url = runFileUrl(runId, image.path)
  return (
    <a {...(hasToken ? {} : { href: url })} target="_blank" rel="noreferrer" className="block rounded-card border border-line bg-canvas p-1">
      <AuthImage src={url} alt={nameOf(image.path)} width={size} height={size} style={{ imageRendering: 'pixelated', width: size, height: size }} className="object-contain" />
    </a>
  )
})

function ScorePill({ score }: { score: number | undefined }) {
  if (score === undefined) return null
  const tone: Tone = score >= 8 ? 'ok' : score >= 5 ? 'warn' : 'danger'
  return <Pill tone={tone} title="Note de revue">{`${Math.round(score * 10) / 10}/10`}</Pill>
}

const AssetCard = memo(function AssetCard({ run, selected, onSelect }: { run: ArtAssetRun; selected: boolean; onSelect: (runId: string) => void }) {
  return (
    <article className="flex w-40 flex-col gap-1.5 rounded-card border border-line bg-card/40 p-2" aria-label={`Run ${run.runId}`}>
      <Picture runId={run.runId} image={run.cover} size={140} />
      <div className="flex flex-wrap items-center gap-1">
        <Pill tone={STATUS_TONE[run.status] ?? 'muted'} dot>{STATUS_LABEL[run.status] ?? run.status}</Pill>
        <ScorePill score={run.score} />
      </div>
      <p className="truncate text-xs text-ink-muted" title={run.cover.path}>{nameOf(run.cover.path)}</p>
      <div className="flex items-center justify-between gap-2 text-xs">
        <button type="button" className="text-accent hover:underline" aria-expanded={selected} onClick={() => onSelect(run.runId)}>
          Détail ({run.images.length})
        </button>
        {run.ticket ? (
          <Link to="/issue/$key" params={{ key: run.ticket }} className="text-accent hover:underline">
            Issue
          </Link>
        ) : null}
      </div>
    </article>
  )
})

/** Every picture of a run side by side, stage by stage, to compare brief, generation, fixes and export. */
function Detail({ run, title, onClose }: { run: ArtAssetRun; title: string; onClose: () => void }) {
  const stages = useMemo(() => {
    const byStage = new Map<string, ArtAssetImage[]>()
    for (const image of run.images) byStage.set(image.stage, [...(byStage.get(image.stage) ?? []), image])
    return [...byStage.entries()].sort(([a], [b]) => stageRank(a) - stageRank(b) || a.localeCompare(b))
  }, [run.images])
  return (
    <section className="rounded-card border border-accent/40 bg-card/60 p-3" aria-label={`Détail du run ${run.runId}`}>
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        <span className="text-xs text-ink-muted">run {run.runId} · {formatDateTime(run.startedAt)}</span>
        <Pill tone={STATUS_TONE[run.status] ?? 'muted'} dot>{STATUS_LABEL[run.status] ?? run.status}</Pill>
        <ScorePill score={run.score} />
        {run.ticket ? (
          <Link to="/issue/$key" params={{ key: run.ticket }} className="text-xs text-accent hover:underline">
            Ouvrir l&apos;issue
          </Link>
        ) : null}
        <button type="button" className="ml-auto text-xs text-ink-muted hover:text-ink" onClick={onClose}>
          Fermer
        </button>
      </header>
      <div className="flex flex-col gap-3">
        {stages.map(([stage, images]) => (
          <div key={stage} aria-label={`Étape ${stage || 'racine'}`}>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{stage || 'racine'}</h4>
            <div className="flex flex-wrap gap-3">
              {images.map((image) => (
                <figure key={image.path} className="flex w-32 flex-col gap-1">
                  <Picture runId={run.runId} image={image} size={120} />
                  <figcaption className="truncate text-xs text-ink-muted" title={image.path}>
                    {nameOf(image.path)} · {formatBytes(image.size)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

interface Group {
  ticket: string
  runs: ArtAssetRun[]
}

/** Runs grouped by issue, the group of the newest run first (runs arrive newest first). */
export function groupByIssue(runs: readonly ArtAssetRun[]): Group[] {
  const groups = new Map<string, ArtAssetRun[]>()
  for (const run of runs) {
    const key = run.ticket ?? NO_ISSUE
    groups.set(key, [...(groups.get(key) ?? []), run])
  }
  return [...groups.entries()].map(([ticket, list]) => ({ ticket, runs: list }))
}

const FIELD = 'min-h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink'

export default function ArtPage() {
  const [status, setStatus] = useState('')
  const [issue, setIssue] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const q = useDeferredValue(search)
  const filters: ArtFilters = { status, issue, q }
  const tickets = useArtTickets()
  const query = useArtAssets(filters)
  const titles = useMemo(() => new Map((tickets.data ?? []).map((ticket) => [ticket.key, ticket.title ?? ''])), [tickets.data])
  const runs = useMemo(() => query.data?.pages.flatMap((page) => page.runs) ?? [], [query.data])
  const groups = useMemo(() => groupByIssue(runs), [runs])
  const detail = runs.find((run) => run.runId === selected) ?? null
  const titleOf = (ticket: string): string => (ticket === NO_ISSUE ? 'Sans issue' : `${ticketLabel(ticket)} ${titles.get(ticket) ?? ''}`.trim())
  const issueKeys = useMemo(() => [...new Set([...(tickets.data ?? []).map((ticket) => ticket.key), ...(issue ? [issue] : [])])].sort(), [tickets.data, issue])

  return (
    <section className="flex max-w-6xl flex-col gap-3">
      <PageHeader title="Art" />
      <div className="flex flex-wrap items-center gap-2" role="search">
        <input type="search" aria-label="Rechercher" placeholder="Rechercher (issue, run, fichier)" className={`${FIELD} w-64`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Statut" className={FIELD} value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select aria-label="Issue" className={FIELD} value={issue} onChange={(event) => setIssue(event.target.value)}>
          <option value="">Toutes les issues</option>
          {issueKeys.map((key) => (
            <option key={key} value={key}>{titleOf(key)}</option>
          ))}
        </select>
      </div>
      <Async query={query} what="Galerie art">
        {() =>
          groups.length === 0 ? (
            <p className="text-xs text-ink-faint">aucun sprite pour ces filtres</p>
          ) : (
            <>
              {detail ? <Detail run={detail} title={titleOf(detail.ticket ?? NO_ISSUE)} onClose={() => setSelected(null)} /> : null}
              {groups.map((group) => (
                <section key={group.ticket} className="flex flex-col gap-2" aria-label={titleOf(group.ticket)}>
                  <h2 className="flex items-baseline gap-2 text-sm">
                    {group.ticket === NO_ISSUE ? (
                      <span className="font-semibold text-ink">Sans issue</span>
                    ) : (
                      <Link to="/issue/$key" params={{ key: group.ticket }} className="font-semibold text-ink hover:underline">
                        {ticketLabel(group.ticket)}
                      </Link>
                    )}
                    <span className="truncate text-ink-soft">{titles.get(group.ticket) ?? ''}</span>
                    <span className="text-xs text-ink-faint">{group.runs.length} run{group.runs.length > 1 ? 's' : ''}</span>
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {group.runs.map((run) => (
                      <AssetCard key={run.runId} run={run} selected={run.runId === selected} onSelect={(id) => setSelected((current) => (current === id ? null : id))} />
                    ))}
                  </div>
                </section>
              ))}
              {query.hasNextPage ? (
                <button type="button" className="self-start rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-raised disabled:opacity-60" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                  {query.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
                </button>
              ) : null}
            </>
          )
        }
      </Async>
    </section>
  )
}
