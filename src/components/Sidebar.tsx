import { Link } from '@tanstack/react-router'
import { InboxBadge } from './InboxBadge'
import { MemoryBadge } from './MemoryBadge'

const LINK = 'flex items-center justify-between rounded-md border-l-2 border-transparent px-3 py-1.5 text-slate-300 hover:bg-surface-2 hover:text-white'
const ACTIVE = { className: 'border-accent bg-surface-2 text-white' }

export function Sidebar() {
  return (
    <nav className="w-44 shrink-0 border-r border-line bg-surface p-2" aria-label="Navigation">
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
          <Link to="/memory" className={LINK} activeProps={ACTIVE}>
            Mémoire
            <MemoryBadge />
          </Link>
        </li>
        <li>
          <Link to="/art" className={LINK} activeProps={ACTIVE}>
            Art
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
