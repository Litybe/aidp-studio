import { Link } from '@tanstack/react-router'
import { InboxBadge } from './InboxBadge'

const LINK = 'flex items-center justify-between rounded px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white'
const ACTIVE = { className: 'bg-slate-800 text-white' }

export function Sidebar() {
  return (
    <nav className="w-44 shrink-0 border-r border-slate-800 bg-slate-900/40 p-2" aria-label="Navigation">
      <ul className="flex flex-col gap-0.5">
        <li>
          <Link to="/board" className={LINK} activeProps={ACTIVE}>
            Board
          </Link>
        </li>
        <li>
          <Link to="/inbox" className={LINK} activeProps={ACTIVE}>
            Inbox
            <InboxBadge />
          </Link>
        </li>
        <li>
          <Link to="/unity" className={LINK} activeProps={ACTIVE}>
            Unity
          </Link>
        </li>
        <li>
          <Link to="/budget" className={LINK} activeProps={ACTIVE}>
            Budget
          </Link>
        </li>
        <li>
          <Link to="/settings" className={LINK} activeProps={ACTIVE}>
            Réglages
          </Link>
        </li>
      </ul>
    </nav>
  )
}
