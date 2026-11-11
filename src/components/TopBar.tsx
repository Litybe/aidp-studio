import { Link, useRouterState } from '@tanstack/react-router'
import { useIsMobile } from '../lib/media'
import { DaemonIndicator } from './DaemonIndicator'
import { DispatcherIndicator } from './DispatcherIndicator'
import { Gauges } from './Gauges'
import { InboxBadge } from './InboxBadge'
import { pageTitle } from './nav'
import { ProjectSelector } from './ProjectSelector'
import { NewRunButton } from './run/LaunchButtons'
import { Icon } from './ui/Icon'

const ICON_BUTTON = 'relative flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-raised hover:text-ink'

/**
 * Always visible. Desktop: the page title, the 5 h and 7 d windows, search, « Nouveau run », the inbox.
 * Phone: brand, project, daemon, gauges (« Nouveau run » lives in the Board's ⋯ menu there).
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const mobile = useIsMobile()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const hideNewRun = mobile && pathname === '/board'
  if (mobile) {
    return (
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        <ProjectSelector className="min-w-0 max-w-44" />
        <DaemonIndicator className="[&>span:last-child]:sr-only" />
        <div className="ml-auto flex items-center gap-2">
          {hideNewRun ? null : <NewRunButton compact />}
          <Gauges compact />
        </div>
      </header>
    )
  }
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <h2 className="truncate text-sm font-semibold text-ink" aria-live="polite">
        {pageTitle(pathname)}
      </h2>
      <div className="ml-auto flex items-center gap-2">
        <DispatcherIndicator />
        <Gauges />
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
        <button type="button" className={ICON_BUTTON} onClick={onSearch} aria-label="Rechercher ou agir (Ctrl K)" title="Rechercher ou agir (Ctrl K)">
          <Icon name="search" size={17} />
        </button>
        <Link to="/inbox" className={ICON_BUTTON} aria-label="Inbox" title="Inbox">
          <Icon name="bell" size={17} />
          <InboxBadge className="absolute -right-0.5 -top-0.5" />
        </Link>
        <NewRunButton />
      </div>
    </header>
  )
}
