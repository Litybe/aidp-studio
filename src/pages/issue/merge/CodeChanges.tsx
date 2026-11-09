import { memo, useMemo, useState } from 'react'
import type { PrFileEntry } from '../../../api/types'
import {
  DIFF_LINE_CAP,
  FILE_CAP,
  type DiffLine,
  initialOpen,
  isBinaryPath,
  parseDiff,
  STATUS_WORD,
} from './diff'
import { usePrFileDiff } from './queries'

const LINE_CLASS: Record<DiffLine['kind'], string> = {
  add: 'bg-st-success/15 text-ink',
  del: 'bg-st-failure/15 text-ink',
  hunk: 'bg-raised text-accent',
  ctx: 'text-ink-soft',
  note: 'text-ink-faint italic',
}

function DiffBody({ patch }: { patch: string }) {
  const [all, setAll] = useState(false)
  const lines = useMemo(() => parseDiff(patch), [patch])
  const shown = all ? lines : lines.slice(0, DIFF_LINE_CAP)
  return (
    <div className="border-t border-line">
      <pre className="overflow-x-auto py-1 font-mono text-xs leading-5">
        {shown.map((line, index) => (
          <span key={index} className={`block min-w-max px-3 whitespace-pre ${LINE_CLASS[line.kind]}`}>
            {line.text === '' ? ' ' : line.text}
          </span>
        ))}
      </pre>
      {lines.length > shown.length ? (
        <button
          type="button"
          className="m-2 min-h-10 rounded border border-line px-3 text-sm text-ink-soft hover:bg-raised"
          onClick={() => setAll(true)}
        >
          Afficher les {lines.length - shown.length} lignes suivantes
        </button>
      ) : null}
    </div>
  )
}

interface CardProps {
  file: PrFileEntry
  defaultOpen: boolean
  repo: string
  number: number
  sha: string
}

function FileCard({ file, defaultOpen, repo, number, sha }: CardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const changed = file.additions + file.deletions
  const binary = isBinaryPath(file.filename)
  const missing = file.patch === null && !binary && changed > 0
  const diff = usePrFileDiff(repo, number, sha, file.filename, open && missing)
  const patch = file.patch ?? diff.data?.diff ?? null
  return (
    <li className="min-w-0 rounded-md border border-line bg-card">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 select-none">
          <span className="min-w-0 flex-1">
            <span className="font-mono text-xs break-all text-ink">{file.filename}</span>
            {file.previousFilename ? (
              <span className="block font-mono text-xs break-all text-ink-faint">depuis {file.previousFilename}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs text-ink-muted">{STATUS_WORD[file.status] ?? file.status}</span>
          <span className="shrink-0 font-mono text-xs">
            <span className="text-st-success">+{file.additions}</span> <span className="text-st-failure">−{file.deletions}</span>
          </span>
        </summary>
        {open ? (
          patch !== null && patch !== '' ? (
            <DiffBody patch={patch} />
          ) : (
            <p className="border-t border-line px-3 py-2 text-sm text-ink-muted">
              {binary || changed === 0
                ? 'Fichier binaire ou sans diff texte.'
                : diff.isError
                  ? `Diff illisible : ${diff.error.message}`
                  : 'Chargement du diff…'}
            </p>
          )
        ) : null}
      </details>
    </li>
  )
}

interface Props {
  files: readonly PrFileEntry[]
  hasMore: boolean
  repo: string
  number: number
  sha: string
}

export const CodeChanges = memo(function CodeChanges({ files, hasMore, repo, number, sha }: Props) {
  const [all, setAll] = useState(false)
  const opens = useMemo(() => initialOpen(files), [files])
  const additions = files.reduce((sum, file) => sum + file.additions, 0)
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0)
  const shown = all ? files : files.slice(0, FILE_CAP)
  if (files.length === 0) return <p className="text-sm text-ink-faint">La PR ne change aucun fichier.</p>
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">
        {files.length}
        {hasMore ? '+' : ''} fichier{files.length > 1 ? 's' : ''} ·{' '}
        <span className="font-mono text-st-success">+{additions}</span> <span className="font-mono text-st-failure">−{deletions}</span>
        {hasMore ? <span className="text-ink-faint"> (les 100 premiers fichiers de la PR)</span> : null}
      </p>
      <ul className="space-y-2">
        {shown.map((file, index) => (
          <FileCard key={file.filename} file={file} defaultOpen={opens[index] ?? false} repo={repo} number={number} sha={sha} />
        ))}
      </ul>
      {files.length > shown.length ? (
        <button
          type="button"
          className="min-h-10 rounded border border-line px-3 text-sm text-ink-soft hover:bg-raised"
          onClick={() => setAll(true)}
        >
          Afficher les {files.length - shown.length} autres fichiers
        </button>
      ) : null}
    </div>
  )
})
