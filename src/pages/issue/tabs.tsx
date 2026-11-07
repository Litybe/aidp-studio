import { useQueries, useQuery } from '@tanstack/react-query'
import { memo, useState } from 'react'
import { AuthImage } from '../../components/AuthImage'
import { apiGetText, isNotFound, runFileUrl } from '../../api/actions'
import { apiGet } from '../../api/client'
import { f1Keys, useJournal, useRunDetail } from '../../api/f1queries'
import type { Assumption, RunFile } from '../../api/types'
import { Soon } from '../../components/ActionControls'
import { formatBytes } from '../../lib/format'
import { Markdown } from './markdown'

const NO_RETRY = { retry: false } as const

/** Files of every run of the ticket, tagged with their run. A run without the route yields nothing. */
export function useAllRunFiles(runIds: readonly string[], enabled: boolean) {
  const results = useQueries({
    queries: runIds.map((runId) => ({
      queryKey: f1Keys.runFiles(runId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGet<RunFile[]>(`/runs/${encodeURIComponent(runId)}/files`, signal),
      enabled,
      ...NO_RETRY,
    })),
  })
  const files = results.flatMap((result, index) =>
    (result.data ?? []).map((file) => ({ ...file, runId: runIds[index] ?? '' })),
  )
  return {
    files,
    missing: results.length > 0 && results.every((result) => result.isError && isNotFound(result.error)),
    pending: results.some((result) => result.isPending && enabled),
  }
}

type RunFileRef = RunFile & { runId: string }

function MarkdownFile({ file }: { file: RunFileRef }) {
  const [open, setOpen] = useState(false)
  const text = useQuery({
    queryKey: f1Keys.runFile(file.runId, file.path),
    queryFn: ({ signal }) => apiGetText(`/runs/${encodeURIComponent(file.runId)}/files/${file.path.split('/').map(encodeURIComponent).join('/')}`, signal),
    enabled: open,
    ...NO_RETRY,
  })
  return (
    <li className="rounded border border-slate-800 bg-slate-900/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {file.stage ? <span className="mr-2 text-xs text-slate-500">{file.stage}</span> : null}
          {file.path}
        </span>
        <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
      </button>
      {open ? (
        <div className="border-t border-slate-800 p-3">
          {text.isPending ? <p className="text-xs text-slate-500">Chargement…</p> : null}
          {text.isError ? <p className="text-xs text-red-400">{text.error.message}</p> : null}
          {text.data !== undefined ? <Markdown source={text.data} /> : null}
        </div>
      ) : null}
    </li>
  )
}

export const ArtifactsTab = memo(function ArtifactsTab({ runIds }: { runIds: readonly string[] }) {
  const { files, missing, pending } = useAllRunFiles(runIds, true)
  if (runIds.length === 0) return <p className="text-sm text-slate-500">Aucun run lié pour l'instant.</p>
  if (missing) return <Soon what="Artefacts" />
  const docs = files.filter((file) => file.kind === 'md')
  if (pending && docs.length === 0) return <p className="text-sm text-slate-500">Chargement…</p>
  if (docs.length === 0) return <p className="text-sm text-slate-500">Aucun artefact Markdown.</p>
  return (
    <ul className="space-y-2">
      {docs.map((file) => (
        <MarkdownFile key={`${file.runId}/${file.path}`} file={file} />
      ))}
    </ul>
  )
})

export const ProofsTab = memo(function ProofsTab({ runIds }: { runIds: readonly string[] }) {
  const { files, missing } = useAllRunFiles(runIds, true)
  if (runIds.length === 0) return <p className="text-sm text-slate-500">Aucun run lié pour l'instant.</p>
  if (missing) return <Soon what="Preuves" />
  const images = files.filter((file) => file.kind === 'png' || file.kind === 'gif')
  if (images.length === 0) return <p className="text-sm text-slate-500">Aucune capture ni GIF.</p>
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {images.map((file) => (
        <li key={`${file.runId}/${file.path}`} className="rounded border border-slate-800 bg-slate-900/50 p-2">
          <AuthImage
            src={runFileUrl(file.runId, file.path)}
            alt={file.path}
            className="max-h-48 w-full object-contain [image-rendering:pixelated]"
          />
          <p className="mt-1 truncate text-xs text-slate-500" title={file.path}>
            {file.path} · {formatBytes(file.size)}
          </p>
        </li>
      ))}
    </ul>
  )
})

const pick = (a: Assumption, snake: keyof Assumption, camel: keyof Assumption) => a[snake] ?? a[camel]

export const AssumptionsTab = memo(function AssumptionsTab({ runIds }: { runIds: readonly string[] }) {
  const last = runIds[runIds.length - 1] ?? ''
  const detail = useRunDetail(last, last !== '')
  if (last === '') return <p className="text-sm text-slate-500">Aucun run lié pour l'instant.</p>
  if (detail.isError && isNotFound(detail.error)) return <Soon what="Hypothèses" />
  const list = detail.data?.assumptions ?? []
  if (list.length === 0) return <p className="text-sm text-slate-500">Aucune décision prise sans demander.</p>
  return (
    <ul className="space-y-2">
      {list.map((item, index) => (
        <li key={index} className="rounded border border-slate-800 p-2 text-sm">
          <p className="text-slate-100">{item.choice}</p>
          {item.reason ? <p className="text-slate-400">Raison : {item.reason}</p> : null}
          {pick(item, 'rejected', 'rejected_alternative') ?? item.rejectedAlternative ? (
            <p className="text-slate-500">Écarté : {String(pick(item, 'rejected', 'rejected_alternative') ?? item.rejectedAlternative)}</p>
          ) : null}
          {pick(item, 'auto_answered', 'autoAnswered') === true ? <p className="text-xs text-amber-400">répondu automatiquement</p> : null}
        </li>
      ))}
    </ul>
  )
})

/** The journal lines are cut to the last `JOURNAL_MAX` (bounded view; the file stays on the daemon). */
export const JOURNAL_MAX = 300

export const JournalTab = memo(function JournalTab({ flowKey }: { flowKey: string }) {
  const journal = useJournal(flowKey, true)
  if (journal.isPending) return <p className="text-sm text-slate-500">Chargement…</p>
  if (journal.isError) return isNotFound(journal.error) ? <Soon what="Journal" /> : <p className="text-sm text-red-400">{journal.error.message}</p>
  const lines = journal.data.slice(-JOURNAL_MAX)
  if (lines.length === 0) return <p className="text-sm text-slate-500">Journal vide.</p>
  return (
    <ol className="space-y-1 font-mono text-xs text-slate-300">
      {lines.map((line, index) => (
        <li key={index}>
          <span className="text-slate-500">{line.time ?? ''}</span> {line.step ?? ''} {line.from ?? ''}
          {line.to ? ` → ${line.to}` : ''} {line.reason ? `(${line.reason})` : ''}
          {line.actor ? <span className="text-slate-500"> · {line.actor}</span> : null}
        </li>
      ))}
    </ol>
  )
})
