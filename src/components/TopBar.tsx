import { Link, useRouterState } from '@tanstack/react-router'
import { useIsMobile } from '../lib/media'
import { DaemonIndicator } from './DaemonIndicator'
import { Gauges } from './Gauges'
import { NewRunButton } from './run/LaunchButtons'
import { InboxBadge } from './InboxBadge'
import { ProjectSelector } from './ProjectSelector'
import { UnityIndicator } from './UnityIndicator'

/** Always visible: name, project, daemon, Unity, the 5 h and 7 d windows, the inbox. */
export function TopBar() {
  // On the phone Board, « Nouveau run » lives in the page's ⋯ menu.
  const mobile = useIsMobile()
  const onBoard = useRouterState({ select: (state) => state.location.pathname === '/board' })
  const hideNewRun = mobile && onBoard
  return (
    <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900 px-3 py-1 md:gap-5 md:px-4">
      <span className="hidden font-semibold tracking-wide text-slate-100 md:inline">aidp-studio</span>
      <ProjectSelector />
      <DaemonIndicator />
      <UnityIndicator />
      <div className="ml-auto flex items-center gap-3 md:gap-5">
        {hideNewRun ? null : <NewRunButton />}
        <Gauges />
        <Link to="/inbox" className="hidden items-center gap-1.5 text-slate-300 hover:text-white md:flex" aria-label="Inbox">
          Inbox
          <InboxBadge />
        </Link>
      </div>
    </header>
  )
}
