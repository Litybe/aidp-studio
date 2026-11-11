import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { DaemonIndicator } from './DaemonIndicator'
import { InboxBadge } from './InboxBadge'
import { MemoryBadge } from './MemoryBadge'
import { NAV_GROUPS, type NavItem } from './nav'
import { ProjectSelector } from './ProjectSelector'
import { Icon } from './ui/Icon'
import { ModelIndicator } from './ModelIndicator'
import { UnityIndicator } from './UnityIndicator'

const STORAGE_KEY = 'aidp-studio.sidebar'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'open')
  } catch {
    // Storage disabled: the choice lasts for this page only.
  }
}

const LINK =
  'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-ink-muted transition-colors hover:bg-raised hover:text-ink'
const ACTIVE = { className: 'bg-accent-soft text-ink [&>.rail]:opacity-100 [&_svg]:text-accent' }

function Badge({ kind, collapsed }: { kind: NavItem['badge']; collapsed: boolean }) {
  if (!kind) return null
  const className = collapsed ? 'absolute -right-1 -top-1 scale-90' : 'ml-auto'
  return kind === 'inbox' ? <InboxBadge className={className} /> : <MemoryBadge className={className} />
}

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <li>
      <Link
        to={item.to}
        className={`${LINK} ${collapsed ? 'justify-center' : ''}`}
        activeProps={ACTIVE}
        activeOptions={{ exact: item.to === '/' }}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        <span aria-hidden="true" className="rail absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent opacity-0" />
        <Icon name={item.icon} size={17} className="text-ink-faint" />
        {collapsed ? null : <span className="truncate">{item.label}</span>}
        <Badge kind={item.badge} collapsed={collapsed} />
        {collapsed ? null : (
          <kbd className="ml-auto opacity-0 group-hover:opacity-100" aria-hidden="true">
            g{item.key}
          </kbd>
        )}
      </Link>
    </li>
  )
}

/** Desktop navigation: brand, project, grouped pages with badges and `g` chords, daemon and Unity state. */
export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  }
  return (
    <nav
      className={`flex shrink-0 flex-col border-r border-line bg-panel ${collapsed ? 'w-14' : 'w-56'}`}
      aria-label="Navigation"
      data-collapsed={collapsed}
    >
      <div className={`flex h-12 items-center gap-2 border-b border-line ${collapsed ? 'justify-center' : 'px-3'}`}>
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-strong text-[0.7rem] font-bold tracking-tight text-white"
        >
          ai
        </span>
        {collapsed ? null : (
          <span className="truncate font-semibold tracking-tight text-ink">
            aidp <span className="font-normal text-ink-faint">studio</span>
          </span>
        )}
      </div>
      {collapsed ? null : (
        <div className="px-2 pt-2">
          <ProjectSelector />
        </div>
      )}
      <div className="px-2 pt-2">
        <button
          type="button"
          className={`flex h-9 w-full items-center gap-2.5 rounded-md border border-line bg-canvas px-2.5 text-ink-faint hover:border-line-strong hover:text-ink-muted ${collapsed ? 'justify-center' : ''}`}
          onClick={onSearch}
          title="Rechercher ou agir (Ctrl K)"
          aria-label="Rechercher ou agir"
        >
          <Icon name="search" size={15} />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-left text-xs">Rechercher…</span>
              <kbd aria-hidden="true">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <div aria-hidden="true" className="mx-2 mb-1.5 border-t border-line" />
            ) : (
              <p className="mb-1 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Item key={item.to} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={`flex flex-col gap-1.5 border-t border-line p-2 text-xs ${collapsed ? 'items-center' : ''}`}>
        <DaemonIndicator className={collapsed ? '[&>span:last-child]:sr-only' : 'px-1'} />
        <UnityIndicator className={collapsed ? '[&>span:last-child]:sr-only' : 'px-1'} />
        <ModelIndicator className={collapsed ? '[&>span:last-child]:sr-only' : 'px-1'} />
        <button
          type="button"
          className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-md text-ink-faint hover:bg-raised hover:text-ink"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} />
          {collapsed ? null : <span>Replier</span>}
        </button>
      </div>
    </nav>
  )
}
