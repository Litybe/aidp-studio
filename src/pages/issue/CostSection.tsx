import { Pill } from '../../components/ui/Pill'
import { formatDateTime, formatUsd } from '../../lib/format'
import { type CostAmount, type CostGroup, type RunCost, useIssueCost } from './issueCost'

const NUMBER = new Intl.NumberFormat('fr-FR')

const th = 'px-2 py-1 text-right font-medium first:text-left'
const td = 'px-2 py-1 text-right tabular-nums first:text-left'

function Counters({ amount }: { amount: CostAmount }) {
  return (
    <>
      <td className={td}>{NUMBER.format(amount.input)}</td>
      <td className={td}>{NUMBER.format(amount.output)}</td>
      <td className={td}>{NUMBER.format(amount.cacheRead)}</td>
      <td className={td}>{NUMBER.format(amount.cacheCreate)}</td>
      <td className={`${td} font-medium text-ink`}>{formatUsd(amount.costUsd)}</td>
    </>
  )
}

function Head({ first }: { first: string }) {
  return (
    <thead className="text-ink-faint">
      <tr>
        <th className={th}>{first}</th>
        <th className={th}>Entrée</th>
        <th className={th}>Sortie</th>
        <th className={th}>Cache lu</th>
        <th className={th}>Cache écrit</th>
        <th className={th}>Coût</th>
      </tr>
    </thead>
  )
}

function GroupTable({ title, first, rows }: { title: string; first: string; rows: CostGroup[] }) {
  if (rows.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" aria-label={title}>
        <caption className="pb-1 text-left text-xs font-medium text-ink-muted">{title}</caption>
        <Head first={first} />
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              <td className={`${td} font-mono`}>{row.key}</td>
              <Counters amount={row} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunRow({ run }: { run: RunCost }) {
  return (
    <details className="border-t border-line text-xs">
      <summary className="flex min-h-10 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 select-none">
        <span className="font-mono text-ink">{run.pipelineId}</span>
        <span className="font-mono text-ink-faint">{run.runId}</span>
        <span className="text-ink-faint">{formatDateTime(run.startedAt)}</span>
        <span className="ml-auto tabular-nums">{`${NUMBER.format(run.totalTokens)} tok`}</span>
        <span className="font-medium text-ink tabular-nums">{formatUsd(run.costUsd)}</span>
        {run.pixellab ? (
          <Pill tone="violet" title="Générations et crédits Pixellab de ce run">
            {`Pixellab ${run.pixellab.generations} gén.${run.pixellab.spent === null ? '' : ` · ${NUMBER.format(run.pixellab.spent)} crédits`}`}
          </Pill>
        ) : null}
      </summary>
      {run.stages.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-xs" aria-label={`Étapes du run ${run.runId}`}>
            <Head first="Étape (agent)" />
            <tbody>
              {run.stages.map((stage) => (
                <tr key={stage.stage} className="border-t border-line">
                  <td className={td}>
                    <span className="font-mono">{stage.stage}</span>
                    {stage.agent ? <span className="text-ink-faint">{` (${stage.agent})`}</span> : null}
                  </td>
                  <Counters amount={stage} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-2 pb-2 text-ink-faint">Aucun usage enregistré pour ce run.</p>
      )}
    </details>
  )
}

/** What the issue cost: tokens and dollars in total, per run, per stage and per agent, plus Pixellab credits. */
export function CostSection({ ticketKey }: { ticketKey: string }) {
  const query = useIssueCost(ticketKey)
  if (!query.data) return null
  const cost = query.data
  const empty = cost.runs.length === 0 && cost.sessionCount === 0
  return (
    <section aria-label="Coût" className="space-y-3 rounded-card border border-line bg-card p-4">
      <h2 className="flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-ink">
        Coût
        {empty ? null : (
          <span className="text-sm font-normal text-ink-muted tabular-nums">
            {`${formatUsd(cost.totals.costUsd)} · ${NUMBER.format(cost.totals.totalTokens)} tokens`}
          </span>
        )}
      </h2>
      {empty ? (
        <p className="text-sm text-ink-faint">Aucun coût enregistré pour cette issue.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Total">
              <Head first="Total des runs" />
              <tbody>
                <tr className="border-t border-line">
                  <td className={td}>{`${cost.runs.length} run${cost.runs.length > 1 ? 's' : ''}`}</td>
                  <Counters amount={cost.totals} />
                </tr>
              </tbody>
            </table>
          </div>
          {cost.pixellab ? (
            <p className="text-sm text-ink-muted">
              {`Pixellab : ${cost.pixellab.generations} génération${cost.pixellab.generations > 1 ? 's' : ''}`}
              {cost.pixellab.credits === null ? '' : ` · ${NUMBER.format(cost.pixellab.credits)} crédits`}
            </p>
          ) : null}
          {cost.runs.length > 0 ? (
            <div role="group" aria-label="Coût par run">
              <h3 className="pb-1 text-xs font-medium text-ink-muted">Par run</h3>
              {cost.runs.map((run) => (
                <RunRow key={run.runId} run={run} />
              ))}
            </div>
          ) : null}
          <GroupTable title="Par étape" first="Étape" rows={cost.byStage} />
          <GroupTable title="Par agent" first="Agent" rows={cost.byAgent} />
          {cost.sessionCount > 0 ? (
            <p className="text-xs text-ink-faint">
              {`Sessions de l'issue (transcripts, hors découpage par run) : ${cost.sessionCount} · ${NUMBER.format(cost.sessions.totalTokens)} tokens · ${formatUsd(cost.sessions.costUsd)}`}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
