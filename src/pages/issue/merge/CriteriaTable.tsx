import { StatusIcon } from '../../../components/StatusIcon'
import type { IconStatus } from '../../../lib/status'
import { countStatuses, type CriterionRow, type CriterionStatus, STATUS_LABEL } from './criteria'

export const STATUS_ICON: Record<CriterionStatus, IconStatus> = {
  pass: 'success',
  fail: 'failure',
  deferred: 'human',
  unverified: 'skipped',
}

const PROOF_PREVIEW = 160

export function StatusBadge({ status }: { status: CriterionStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StatusIcon status={STATUS_ICON[status]} />
      <span>{STATUS_LABEL[status]}</span>
    </span>
  )
}

/** « 5 réussis · 1 reporté · 0 échoué · 2 non vérifiés » for the strip above the page. */
export function CriteriaSummary({ rows }: { rows: readonly CriterionRow[] }) {
  const counts = countStatuses(rows)
  if (rows.length === 0) return <span className="text-slate-400">Aucun critère d'acceptation trouvé dans l'issue.</span>
  const order: CriterionStatus[] = ['pass', 'fail', 'deferred', 'unverified']
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {order.map((status) => (
        <span key={status} className={`inline-flex items-center gap-1.5 ${counts[status] === 0 ? 'text-slate-500' : 'text-slate-100'}`}>
          <StatusIcon status={STATUS_ICON[status]} />
          <span>
            {counts[status]} {STATUS_LABEL[status]}
          </span>
        </span>
      ))}
    </span>
  )
}

function Proof({ row }: { row: CriterionRow }) {
  if (row.proof === '' && row.status === 'unverified') {
    return <span className="text-slate-500">Aucun résultat trouvé dans les stages.</span>
  }
  const long = row.proof.length > PROOF_PREVIEW
  return (
    <div className="space-y-1 text-slate-300">
      {row.proof !== '' ? (
        long ? (
          <details>
            <summary className="min-h-10 cursor-pointer py-1">
              {row.proof.slice(0, PROOF_PREVIEW)}… <span className="text-accent">voir tout</span>
            </summary>
            <p className="mt-1">{row.proof}</p>
          </details>
        ) : (
          <p>{row.proof}</p>
        )
      ) : null}
      {row.source ? (
        <p className="text-xs text-slate-500">
          {row.source}
          {row.status === 'unverified' && row.raw ? ` · statut brut « ${row.raw} »` : ''}
        </p>
      ) : null}
    </div>
  )
}

const GRID = 'md:grid md:grid-cols-[4.5rem_minmax(0,1fr)_11rem_minmax(0,1.2fr)] md:gap-x-4'

/** The criteria with their result: a table on a wide screen, one card per criterion on a phone. */
export function CriteriaTable({ rows }: { rows: readonly CriterionRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Aucun critère d'acceptation trouvé dans l'issue.</p>
  return (
    <div role="table" aria-label="Critères d'acceptation" className="text-sm">
      <div role="row" className={`hidden border-b border-line px-3 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase ${GRID}`}>
        <span role="columnheader">Critère</span>
        <span role="columnheader">Libellé</span>
        <span role="columnheader">Résultat</span>
        <span role="columnheader">Preuve</span>
      </div>
      <div role="rowgroup" className="space-y-2 md:space-y-0">
        {rows.map((row) => (
          <div
            key={row.id}
            role="row"
            className={`space-y-1.5 rounded-md border px-3 py-2.5 md:rounded-none md:border-0 md:border-b md:border-line-soft ${GRID} ${
              row.status === 'fail' ? 'border-st-failure/60 bg-st-failure/10' : 'border-line bg-surface'
            }`}
          >
            <div className="flex items-center justify-between gap-2 md:contents">
              <span role="cell" className="font-mono font-semibold text-slate-100">
                {row.id}
              </span>
              <span role="cell" className="md:order-3">
                <StatusBadge status={row.status} />
              </span>
            </div>
            <p role="cell" className="text-slate-200 md:order-2">
              {row.label !== '' ? row.label : <span className="text-slate-500">{row.listed ? '' : 'Vérification des stages, absente de l\'issue.'}</span>}
            </p>
            <div role="cell" className="md:order-4">
              <Proof row={row} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
