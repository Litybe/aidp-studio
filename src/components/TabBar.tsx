import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { InboxBadge } from './InboxBadge'
import { MemoryBadge } from './MemoryBadge'
import { MORE_ITEMS, TAB_ITEMS, type NavItem } from './nav'
import { Icon } from './ui/Icon'

const TAB = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] text-ink-faint'
const ACTIVE = { className: 'text-accent [&_svg]:text-accent' }

function Badge({ kind }: { kind: NavItem['badge'] }) {
  if (!kind) return null
  const className = 'absolute left-1/2 top-1.5 ml-1'
  return kind === 'inbox' ? <InboxBadge className={className} /> : <MemoryBadge className={className} />
}

/** Phone navigation: fixed bottom bar with icons; the rarely used pages sit behind « Plus… ». */
export function TabBar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="relative shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]" aria-label="Navigation">
      {open ? (
        <ul className="absolute bottom-full right-2 mb-1 w-52 overflow-hidden rounded-card border border-line bg-card shadow-lg shadow-black/40">
          {MORE_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-12 items-center gap-3 px-4 text-ink-muted"
                activeProps={{ className: 'text-ink bg-raised' }}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} size={17} className="text-ink-faint" />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'memory' ? <MemoryBadge /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex">
        {TAB_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={TAB} activeProps={ACTIVE} activeOptions={{ exact: item.to === '/' }}>
            <Icon name={item.icon} size={20} />
            <Badge kind={item.badge} />
            {item.label}
          </Link>
        ))}
        <button type="button" className={`${TAB} ${open ? 'text-ink' : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Icon name="dots" size={20} />
          Plus…
        </button>
      </div>
    </nav>
  )
}
