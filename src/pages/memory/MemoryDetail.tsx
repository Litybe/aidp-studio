import { useState } from 'react'
import { ApiValidationError } from '../../api/send'
import { MEMORY_KINDS, type Memory, type MemoryKind } from '../../api/types/memory'
import { formatDateTime } from '../../lib/format'
import { KIND_LABEL, STATUS_LABEL, useApprove, useArchive, useEditMemory, useMerge } from './queries'

const BUTTON = 'rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50'
const INPUT = 'rounded border border-slate-700 bg-slate-950 px-2 py-1'

function ErrorLine({ error }: { error: unknown }) {
  if (!(error instanceof Error)) return null
  const extra = error instanceof ApiValidationError ? [...error.fields.map((field) => `${field.path} : ${field.message}`), ...error.general] : []
  return (
    <p role="alert" className="text-xs text-rose-400">
      {[error.message, ...extra].join(' ; ')}
    </p>
  )
}

function EditForm({ memory, onDone }: { memory: Memory; onDone: () => void }) {
  const edit = useEditMemory()
  const [title, setTitle] = useState(memory.title)
  const [text, setText] = useState(memory.text)
  const [kind, setKind] = useState<MemoryKind>(memory.kind)
  return (
    <form
      className="flex flex-col gap-2"
      aria-label="Éditer la mémoire"
      onSubmit={(event) => {
        event.preventDefault()
        edit.mutate({ id: memory.id, patch: { title, text, kind } }, { onSuccess: onDone })
      }}
    >
      <input className={INPUT} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Titre" />
      <select className={INPUT} value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)} aria-label="Type">
        {MEMORY_KINDS.map((value) => (
          <option key={value} value={value}>
            {KIND_LABEL[value]}
          </option>
        ))}
      </select>
      <textarea className={`${INPUT} min-h-24`} value={text} maxLength={600} onChange={(event) => setText(event.target.value)} aria-label="Texte" />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50" disabled={edit.isPending}>
          Enregistrer
        </button>
        <button type="button" className={BUTTON} onClick={onDone}>
          Annuler
        </button>
      </div>
      <ErrorLine error={edit.error} />
    </form>
  )
}

/** One memory: text, scope, refs, and the actions of its life cycle (approve, archive, merge, edit). */
export function MemoryDetail({ memory }: { memory: Memory }) {
  const approve = useApprove()
  const archive = useArchive()
  const merge = useMerge()
  const [editing, setEditing] = useState(false)
  const [into, setInto] = useState('')
  const canApprove = memory.status === 'proposed' || memory.status === 'stale'
  const canArchive = memory.status !== 'archived' && memory.status !== 'superseded'
  const error = approve.error ?? archive.error ?? merge.error
  return (
    <section className="flex flex-col gap-3 rounded border border-slate-800 bg-slate-900/40 p-4" aria-label="Détail de la mémoire">
      <header>
        <h2 className="text-sm font-semibold text-slate-100">{memory.title}</h2>
        <p className="text-xs text-slate-400">
          {memory.id} · {KIND_LABEL[memory.kind] ?? memory.kind} · {STATUS_LABEL[memory.status] ?? memory.status}
          {memory.uses !== undefined ? ` · ${memory.uses} usages` : ''}
          {memory.lastUsedAt ? ` · dernier ${formatDateTime(memory.lastUsedAt)}` : ''}
        </p>
      </header>
      {editing ? (
        <EditForm key={memory.id} memory={memory} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="whitespace-pre-wrap text-slate-200">{memory.text}</p>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-0.5 text-xs">
            {memory.scope?.route ? (
              <>
                <dt className="text-slate-400">Route</dt>
                <dd>{memory.scope.route}</dd>
              </>
            ) : null}
            {memory.scope?.paths?.length ? (
              <>
                <dt className="text-slate-400">Chemins</dt>
                <dd className="break-all">{memory.scope.paths.join(', ')}</dd>
              </>
            ) : null}
            {memory.scope?.tags?.length ? (
              <>
                <dt className="text-slate-400">Tags</dt>
                <dd>{memory.scope.tags.join(', ')}</dd>
              </>
            ) : null}
            {memory.refs?.length ? (
              <>
                <dt className="text-slate-400">Références</dt>
                <dd>{memory.refs.map((ref) => `${ref.type} ${ref.id}`).join(', ')}</dd>
              </>
            ) : null}
            {memory.supersedes ? (
              <>
                <dt className="text-slate-400">Remplace</dt>
                <dd>{memory.supersedes}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {canApprove ? (
              <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50" disabled={approve.isPending} onClick={() => approve.mutate(memory.id)}>
                Approuver
              </button>
            ) : null}
            {canArchive ? (
              <button type="button" className={BUTTON} disabled={archive.isPending} onClick={() => archive.mutate(memory.id)}>
                Archiver
              </button>
            ) : null}
            <button type="button" className={BUTTON} onClick={() => setEditing(true)}>
              Éditer
            </button>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            aria-label="Fusionner"
            onSubmit={(event) => {
              event.preventDefault()
              if (into.trim() !== '') merge.mutate({ id: memory.id, into: into.trim() }, { onSuccess: () => setInto('') })
            }}
          >
            <input className={`${INPUT} w-28`} value={into} onChange={(event) => setInto(event.target.value)} placeholder="M-12" aria-label="Fusionner dans" />
            <button type="submit" className={BUTTON} disabled={merge.isPending || into.trim() === ''}>
              Fusionner
            </button>
          </form>
          <ErrorLine error={error} />
        </>
      )}
    </section>
  )
}
