import { apiPost, routes, useApiAction } from '../../api/actions'
import { useDispatcherBudget } from '../../api/queries'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { NewRunButton } from '../../components/run/LaunchButtons'

const selectPaused = (budget: { verdict: { verdict: string } }) => budget.verdict.verdict === 'paused'

/** Global board actions: Sync GitHub, dispatcher pause/resume, and « Nouveau run » on request. */
export function Toolbar({ withNewRun = false }: { withNewRun?: boolean }) {
  const paused = useDispatcherBudget(selectPaused).data === true
  const sync = useApiAction(() => apiPost(routes.ticketsSync))
  const dispatcher = useApiAction((verb: 'pause' | 'resume') => apiPost(routes.dispatcher(verb)))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton label="Sync GitHub" icon="github" onRun={() => sync.run()} />
      <ActionButton
        label={paused ? 'Reprendre le dispatcher' : 'Pause du dispatcher'}
        icon={paused ? 'play' : 'pause'}
        tone={paused ? 'primary' : 'neutral'}
        onRun={() => dispatcher.run(paused ? 'resume' : 'pause')}
      />
      {withNewRun ? <NewRunButton /> : null}
      <FeedbackLine feedback={sync.feedback} />
      <FeedbackLine feedback={dispatcher.feedback} />
    </div>
  )
}
