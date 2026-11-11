import { useDispatcherBudget, useDispatcherState, type DispatcherState } from '../api/queries'
import { Pill } from './ui/Pill'

type Tone = 'ok' | 'warn' | 'muted'

/** Pure: the label and tone of the dispatcher, from its state and the budget verdict. */
export function dispatcherSummary(state: DispatcherState, budgetPaused: boolean): { label: string; tone: Tone } {
  if (state.paused || state.mode === 'paused') return { label: 'en pause (manuel)', tone: 'warn' }
  if (budgetPaused) return { label: 'en pause (budget)', tone: 'warn' }
  if (state.mode === 'waiting') {
    const until = state.waitUntil ? new Date(state.waitUntil) : null
    const hhmm = until && !Number.isNaN(until.getTime()) ? until.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null
    return { label: hhmm ? `en attente jusqu'à ${hhmm}` : 'en attente', tone: 'muted' }
  }
  return { label: 'actif', tone: 'ok' }
}

const selectBudgetPaused = (budget: { verdict: { verdict: string } }) => budget.verdict.verdict === 'paused'
const identity = (state: DispatcherState) => state

/** `Dispatcher : actif · 1/3`. With `onClick`, a click toggles pause. */
export function DispatcherIndicator({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  const state = useDispatcherState(identity).data
  const budgetPaused = useDispatcherBudget(selectBudgetPaused).data === true
  if (!state) return null
  const { label, tone } = dispatcherSummary(state, budgetPaused)
  const title = [state.lastReason, state.lastTickAt ? `dernier passage : ${state.lastTickAt}` : ''].filter(Boolean).join(' - ')
  const pill = (
    <Pill tone={tone} dot title={title || undefined} className={className}>
      Dispatcher : {label} · {state.slots.used}/{state.slots.max}
    </Pill>
  )
  if (!onClick) return pill
  return (
    <button type="button" onClick={onClick} className="rounded-full" aria-label={`Dispatcher : ${label}`}>
      {pill}
    </button>
  )
}
