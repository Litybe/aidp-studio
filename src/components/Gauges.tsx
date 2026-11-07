import { useDispatcherBudget, useLastRateLimit } from '../api/queries'
import type { DispatcherBudget } from '../api/types'
import { gaugeInputs } from '../lib/gauge'
import { Gauge } from './Gauge'

const selectBudget = (budget: DispatcherBudget) => budget

/** The 5 h and 7 d gauges: `GET /api/dispatcher/budget`, else the last snapshot of `GET /api/usage/rate-limit`. */
export function Gauges() {
  const budget = useDispatcherBudget(selectBudget)
  const needsHistory = budget.isSuccess && budget.data.live === null
  const history = useLastRateLimit(needsHistory)
  const inputs = gaugeInputs(budget.data, needsHistory ? history.data : null)
  return (
    <div className="flex items-center gap-2 md:gap-4">
      <Gauge label="5h" source={inputs.source} {...inputs.fiveHour} />
      <Gauge label="7j" source={inputs.source} {...inputs.sevenDay} />
    </div>
  )
}
