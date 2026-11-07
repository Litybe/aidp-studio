import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { InboxBadge } from './InboxBadge'
import { MemoryBadge } from './MemoryBadge'

const TAB = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs text-slate-400'
const ACTIVE = { className: 'text-white bg-slate-800' }

const MORE = [
  { to: '/memory', label: 'Mémoire' },
  { to: '/art', label: 'Art' },
  { to: '/settings', label: 'Réglages' },
] as const

/** Phone navigation: fixed bottom bar; the rarely used pages sit behind « Plus ». */
export function TabBar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="relative shrink-0 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]" aria-label="Navigation">
      {open ? (
        <ul className="absolute bottom-full right-0 w-48 border border-slate-700 bg-slate-900 shadow-lg">
          {MORE.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex min-h-12 items-center justify-between px-4 text-slate-200" activeProps={ACTIVE} onClick={() => setOpen(false)}>
                {item.label}
                {item.to === '/memory' ? <MemoryBadge /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex">
        <Link to="/board" className={TAB} activeProps={ACTIVE}>
          Board
        </Link>
        <Link to="/inbox" className={TAB} activeProps={ACTIVE}>
          <span className="flex items-center gap-1">
            Inbox
            <InboxBadge />
          </span>
        </Link>
        <Link to="/unity" className={TAB} activeProps={ACTIVE}>
          Unity
        </Link>
        <Link to="/budget" className={TAB} activeProps={ACTIVE}>
          Budget
        </Link>
        <button type="button" className={TAB} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          Plus…
        </button>
      </div>
    </nav>
  )
}
