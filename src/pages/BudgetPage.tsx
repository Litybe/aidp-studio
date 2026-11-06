import { Placeholder } from '../components/Placeholder'
import { useDispatcherBudget } from '../api/queries'
import type { DispatcherBudget } from '../api/types'

const VERDICT_LABEL: Record<string, string> = {
  allow: 'lancements autorisés',
  conservative: 'prudent',
  wait: 'en attente de fenêtre',
  paused: 'en pause',
  '': 'pas encore de tick',
}

const selectVerdict = (budget: DispatcherBudget) => budget.verdict

export default function BudgetPage() {
  const verdict = useDispatcherBudget(selectVerdict).data
  return (
    <Placeholder title="Budget" lot="F1 en lecture : jauges, verdict du dispatcher, tokens par jour, top des issues.">
      {verdict ? (
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
          <dt className="text-slate-400">Verdict</dt>
          <dd>{VERDICT_LABEL[verdict.verdict] ?? verdict.verdict}</dd>
          <dt className="text-slate-400">Raison</dt>
          <dd>{verdict.why || '—'}</dd>
          <dt className="text-slate-400">Seuils 5h / 7j</dt>
          <dd>
            {Math.round(verdict.limit5h * 100)}% / {Math.round(verdict.limit7d * 100)}%
          </dd>
        </dl>
      ) : null}
    </Placeholder>
  )
}
