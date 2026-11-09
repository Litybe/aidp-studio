import { PageHeader } from '../../components/ui/PageHeader'
import { CARD, H2, INPUT } from '../../components/ui/classes'
import { memo, useState, type FormEvent } from 'react'
import { MEMORY_KINDS, MEMORY_STATUSES } from '../../api/types/memory'
import { Async } from '../../components/Async'
import { MemoryDetail } from './MemoryDetail'
import { MemoryList } from './MemoryList'
import { citation, KIND_LABEL, STATUS_LABEL, useMemories, useRagSearch, useReindex } from './queries'

const SOURCES = ['', 'bible', 'doc', 'code', 'run', 'ticket', 'knowledge', 'memory'] as const

const SearchCard = memo(function SearchCard() {
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')
  const [submitted, setSubmitted] = useState('')
  const search = useRagSearch(submitted, source)
  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(draft.trim())
  }
  return (
    <section className={CARD} aria-label="Recherche RAG">
      <h2 className={H2}>Recherche dans le corpus</h2>
      <form onSubmit={submit} className="mb-2 flex flex-wrap gap-2">
        <input className={`${INPUT} min-w-64 flex-1`} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Requête" placeholder="vitesse du Rigidbody2D" />
        <select className={INPUT} value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source">
          {SOURCES.map((value) => (
            <option key={value} value={value}>
              {value === '' ? 'toutes les sources' : value}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-accent-strong px-3 py-1.5 font-medium text-white hover:bg-accent">
          Chercher
        </button>
      </form>
      {submitted === '' ? null : (
        <Async query={search} what="Recherche RAG">
          {(hits) =>
            hits.length === 0 ? (
              <p className="text-xs text-ink-faint">aucun résultat</p>
            ) : (
              <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
                {hits.map((hit) => (
                  <li key={hit.id} className="rounded-card border border-line p-2">
                    <p className="font-mono text-xs text-accent">
                      {citation(hit)} <span className="text-ink-faint">· {hit.source}</span>
                    </p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-ink-soft">{hit.text}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      )}
    </section>
  )
})

function ReindexButton() {
  const reindex = useReindex()
  const result = reindex.data
  return (
    <span className="flex items-center gap-2 text-xs">
      <button type="button" className="rounded border border-line-strong px-2 py-1 hover:bg-raised disabled:opacity-50" disabled={reindex.isPending} onClick={() => reindex.mutate()}>
        Réindexer
      </button>
      {reindex.isPending ? <span className="text-ink-muted">indexation…</span> : null}
      {result ? (
        <span className="text-emerald-400">
          {result.indexed ?? 0} indexés, {result.updated ?? 0} mis à jour, {result.removed ?? 0} retirés
        </span>
      ) : null}
      {reindex.isError ? (
        <span role="alert" className="text-rose-400">
          {reindex.error.message}
        </span>
      ) : null}
    </span>
  )
}

export default function MemoryPage() {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useMemories({ status, kind, q })
  return (
    <section className="flex max-w-5xl flex-col gap-4">
      <PageHeader title="Mémoire" subtitle="Faits, préférences et propositions apprises par les runs.">
        <ReindexButton />
      </PageHeader>
      <form
        className="flex flex-wrap gap-2"
        aria-label="Filtres"
        onSubmit={(event) => {
          event.preventDefault()
          setQ(draft.trim())
        }}
      >
        <select className={INPUT} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Statut">
          <option value="">tous les statuts</option>
          {MEMORY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <select className={INPUT} value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Type">
          <option value="">tous les types</option>
          {MEMORY_KINDS.map((value) => (
            <option key={value} value={value}>
              {KIND_LABEL[value]}
            </option>
          ))}
        </select>
        <input className={`${INPUT} min-w-48`} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Filtrer" placeholder="texte, titre, tag" />
        <button type="submit" className="rounded border border-line-strong px-3 py-1 hover:bg-raised">
          Filtrer
        </button>
      </form>
      <Async query={query} what="Gestionnaire de mémoire">
        {(memories) => {
          const selected = memories.find((memory) => memory.id === selectedId) ?? null
          return (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <MemoryList memories={memories} selectedId={selectedId} onSelect={setSelectedId} />
              {selected ? <MemoryDetail key={selected.id} memory={selected} /> : <p className="text-xs text-ink-faint">Choisis une mémoire.</p>}
            </div>
          )
        }}
      </Async>
      <SearchCard />
    </section>
  )
}
