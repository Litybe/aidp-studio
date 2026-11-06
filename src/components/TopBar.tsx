import { Link } from '@tanstack/react-router'
import { DaemonIndicator } from './DaemonIndicator'
import { Gauges } from './Gauges'
import { InboxBadge } from './InboxBadge'
import { ProjectSelector } from './ProjectSelector'
import { StatusDot } from './StatusDot'

/** Always visible: name, project, daemon, Unity, the 5 h and 7 d windows, the inbox. */
export function TopBar() {
  return (
    <header className="flex h-11 shrink-0 items-center gap-5 border-b border-slate-800 bg-slate-900 px-4">
      <span className="font-semibold tracking-wide text-slate-100">aidp-studio</span>
      <ProjectSelector />
      <DaemonIndicator />
      <span className="flex items-center gap-1.5" title="GET /api/unity/status n'existe pas encore">
        <StatusDot tone="muted" />
        <span className="text-slate-400">Unity : inconnu</span>
      </span>
      <div className="ml-auto flex items-center gap-5">
        <Gauges />
        <Link to="/inbox" className="flex items-center gap-1.5 text-slate-300 hover:text-white" aria-label="Inbox">
          Inbox
          <InboxBadge />
        </Link>
      </div>
    </header>
  )
}
