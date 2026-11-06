import { memo, useState } from 'react'
import { useDispatcherBudget, useLastRateLimit } from '../../api/queries'
import type { DispatcherBudget } from '../../api/types'
import type { UsageBucket, UsageGroupBy } from '../../api/types/budget'
import { Async } from '../../components/Async'
import { BarChart, formatTokens } from '../../components/BarChart'
import { Gauge } from '../../components/Gauge'
import { gaugeInputs } from '../../lib/gauge'
import { ticketLabel } from '../unity/queries'
import { BudgetSettingsForm } from './BudgetSettingsForm'
import {
  bucketBars,
  dayBars,
  sinceDate,
  topBuckets,
  USAGE_DAYS,
  useAnomalies,
  useBudgetSettings,
  usePixellabBalance,
  useUsage,
} from './queries'

const CARD = 'rounded border border-slate-800 bg-slate-900/40 p-4'
const H2 = 'mb-2 text-sm font-semibold text-slate-100'

const VERDICT_LABEL: Record<string, string> = {
  allow: 'lancements autorisés',
  conservative: 'prudent',
  wait: 'en attente de fenêtre',
  paused: 'en pause',
  '': 'pas encore de tick',
}

const selectBudget = (budget: DispatcherBudget) => budget

const GaugesCard = memo(function GaugesCard() {
  const budget = useDispatcherBudget(selectBudget)
  const needsHistory = budget.isSuccess && budget.data.live === null
  const history = useLastRateLimit(needsHistory)
  const inputs = gaugeInputs(budget.data, needsHistory ? history.data : null)
  const verdict = budget.data?.verdict
  return (
    <section className={CARD} aria-label="Fenêtres et verdict">
      <h2 className={H2}>Fenêtres 5 h et 7 j</h2>
      <div className="flex flex-wrap gap-6">
        <Gauge label="5h" source={inputs.source} {...inputs.fiveHour} />
        <Gauge label="7j" source={inputs.source} {...inputs.sevenDay} />
      </div>
      {verdict ? (
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-0.5">
          <dt className="text-slate-400">Verdict du dispatcher</dt>
          <dd data-testid="verdict">{VERDICT_LABEL[verdict.verdict] ?? verdict.verdict}</dd>
          <dt className="text-slate-400">Raison</dt>
          <dd>{verdict.why || '—'}</dd>
          <dt className="text-slate-400">Seuils 5h / 7j</dt>
          <dd>
            {Math.round(verdict.limit5h * 100)}% / {Math.round(verdict.limit7d * 100)}%
          </dd>
          <dt className="text-slate-400">Lancements max</dt>
          <dd>{verdict.maxLaunches}</dd>
        </dl>
      ) : null}
    </section>
  )
})

const ChartCard = memo(function ChartCard({ title, groupBy, from, bars }: { title: string; groupBy: UsageGroupBy; from: string; bars: (buckets: UsageBucket[]) => ReturnType<typeof bucketBars> }) {
  const query = useUsage(groupBy, from)
  return (
    <section className={CARD} aria-label={title}>
      <h2 className={H2}>{title}</h2>
      <Async query={query} what={title} soft400>
        {(usage) => <BarChart items={bars(usage.buckets)} ariaLabel={title} />}
      </Async>
    </section>
  )
})

const dayItems = (buckets: UsageBucket[]) => dayBars(buckets)
const defaultItems = (buckets: UsageBucket[]) => bucketBars(buckets)

const TopIssues = memo(function TopIssues({ from }: { from: string }) {
  const query = useUsage('ticket', from)
  return (
    <section className={CARD} aria-label="Issues les plus chères">
      <h2 className={H2}>Issues les plus chères</h2>
      <Async query={query} what="Coût par issue" soft400>
        {(usage) => {
          const top = topBuckets(usage.buckets)
          return top.length === 0 ? (
            <p className="text-xs text-slate-500">aucune donnée</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="font-normal">Issue</th>
                  <th className="text-right font-normal">Tokens</th>
                  <th className="text-right font-normal">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {top.map((bucket) => (
                  <tr key={bucket.key}>
                    <td>{ticketLabel(bucket.key)}</td>
                    <td className="text-right tabular-nums">{formatTokens(bucket.totalTokens)}</td>
                    <td className="text-right tabular-nums">{bucket.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }}
      </Async>
    </section>
  )
})

function describeBalance(balance: unknown): string {
  if (balance === null || balance === undefined) return 'inconnu'
  if (typeof balance === 'number' || typeof balance === 'string') return String(balance)
  if (typeof balance === 'object') {
    return Object.entries(balance as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
      .map(([key, value]) => `${key} : ${String(value)}`)
      .join(' · ')
  }
  return 'inconnu'
}

const PixellabCard = memo(function PixellabCard() {
  const query = usePixellabBalance()
  return (
    <section className={CARD} aria-label="Pixellab">
      <h2 className={H2}>Crédits Pixellab</h2>
      <Async query={query} what="Solde Pixellab">
        {(body) => (
          <p>
            {describeBalance(body.balance)}
            {body.minReserve != null ? <span className="text-slate-400"> · réserve minimale {body.minReserve}</span> : null}
            {body.recordedAt ? <span className="text-xs text-slate-500"> · relevé {body.recordedAt}</span> : null}
          </p>
        )}
      </Async>
    </section>
  )
})

const AnomaliesCard = memo(function AnomaliesCard() {
  const query = useAnomalies()
  return (
    <section className={CARD} aria-label="Anomalies">
      <h2 className={H2}>Anomalies de coût</h2>
      <Async query={query} what="Anomalies de coût">
        {(items) =>
          items.length === 0 ? (
            <p className="text-slate-400">Aucune anomalie.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {items.map((item, index) => (
                <li key={`${item.ticketKey ?? ''}${item.at ?? ''}${index}`} className="text-amber-300">
                  {item.ticketKey ? `${ticketLabel(item.ticketKey)} : ` : ''}
                  {item.message}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </section>
  )
})

const SettingsCard = memo(function SettingsCard() {
  const query = useBudgetSettings()
  return (
    <section className={CARD} aria-label="Plafonds">
      <h2 className={H2}>Plafonds et planification</h2>
      <Async query={query} what="Réglages du budget">
        {(settings) => <BudgetSettingsForm settings={settings} />}
      </Async>
    </section>
  )
})

export default function BudgetPage() {
  const [from] = useState(() => sinceDate(USAGE_DAYS, Date.now()))
  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-100">Budget</h1>
      <GaugesCard />
      <ChartCard title="Tokens par jour" groupBy="day" from={from} bars={dayItems} />
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title="Par route" groupBy="route" from={from} bars={defaultItems} />
        <ChartCard title="Par stage" groupBy="stage" from={from} bars={defaultItems} />
        <ChartCard title="Par modèle" groupBy="model" from={from} bars={defaultItems} />
      </div>
      <TopIssues from={from} />
      <div className="grid gap-4 md:grid-cols-2">
        <PixellabCard />
        <AnomaliesCard />
      </div>
      <SettingsCard />
    </section>
  )
}
