import { useDispatcherBudget, useLastRateLimit } from '../api/queries'
import type { DispatcherBudget } from '../api/types'
import { gaugeInputs } from '../lib/gauge'
import { Gauge } from './Gauge'

const selectBudget = (budget: DispatcherBudget) => budget

/** The 5 h and 7 d gauges: `GET /api/dispatcher/budget`, else the last snapshot of `GET /api/usage/rate-limit`. */
export function Gauges({ compact = false }: { compact?: boolean }) {
  const budget = useDispatcherBudget(selectBudget)
  const needsHistory = budget.isSuccess && budget.data.live === null
  const history = useLastRateLimit(needsHistory)
  const inputs = gaugeInputs(budget.data, needsHistory ? history.data : null)
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <Gauge label="5h" source={inputs.source} compact={compact} {...inputs.fiveHour} />
      <Gauge label="7j" source={inputs.source} compact={compact} {...inputs.sevenDay} />
    </div>
  )
}
