import { apiPost, routes, useApiAction } from '../../api/actions'
import { useDispatcherPaused } from '../../api/queries'
import { ActionButton, FeedbackLine } from '../../components/ActionControls'
import { DispatcherIndicator } from '../../components/DispatcherIndicator'
import { NewRunButton } from '../../components/run/LaunchButtons'

/** Global board actions: Sync GitHub, dispatcher pause/resume, and « Nouveau run » on request. */
export function Toolbar({ withNewRun = false }: { withNewRun?: boolean }) {
  const paused = useDispatcherPaused()
  const sync = useApiAction(() => apiPost(routes.ticketsSync))
  const dispatcher = useApiAction((verb: 'pause' | 'resume') => apiPost(routes.dispatcher(verb), verb === 'pause' ? { paused: true } : undefined))
  const tick = useApiAction(() => apiPost(routes.dispatcherTick))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton label="Sync GitHub" icon="github" onRun={() => sync.run()} />
      <ActionButton
        label={paused ? 'Reprendre le dispatcher' : 'Pause du dispatcher'}
        icon={paused ? 'play' : 'pause'}
        tone={paused ? 'primary' : 'neutral'}
        onRun={() => dispatcher.run(paused ? 'resume' : 'pause')}
      />
      <DispatcherIndicator onClick={() => dispatcher.run(paused ? 'resume' : 'pause')} />
      <ActionButton label="Lancer un passage" icon="refresh" onRun={() => tick.run()} />
      {withNewRun ? <NewRunButton /> : null}
      <FeedbackLine feedback={sync.feedback} />
      <FeedbackLine feedback={dispatcher.feedback} />
      <FeedbackLine feedback={tick.feedback} />
    </div>
  )
}
