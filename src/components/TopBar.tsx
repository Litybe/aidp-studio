import { Link } from '@tanstack/react-router'
import { DaemonIndicator } from './DaemonIndicator'
import { Gauges } from './Gauges'
import { NewRunButton } from './run/LaunchButtons'
import { InboxBadge } from './InboxBadge'
import { ProjectSelector } from './ProjectSelector'
import { UnityIndicator } from './UnityIndicator'

/** Always visible: name, project, daemon, Unity, the 5 h and 7 d windows, the inbox. */
export function TopBar() {
  return (
    <header className="flex h-11 shrink-0 items-center gap-5 border-b border-slate-800 bg-slate-900 px-4">
      <span className="font-semibold tracking-wide text-slate-100">aidp-studio</span>
      <ProjectSelector />
      <DaemonIndicator />
      <UnityIndicator />
      <div className="ml-auto flex items-center gap-5">
        <NewRunButton />
        <Gauges />
        <Link to="/inbox" className="flex items-center gap-1.5 text-slate-300 hover:text-white" aria-label="Inbox">
          Inbox
          <InboxBadge />
        </Link>
      </div>
    </header>
  )
}
