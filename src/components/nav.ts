import type { IconName } from './ui/Icon'

export interface NavItem {
  to: '/' | '/board' | '/inbox' | '/unity' | '/budget' | '/memory' | '/art' | '/settings'
  label: string
  icon: IconName
  /** Second key of the `g` chord (`g b` opens the board). */
  key: string
  /** Shown as a badge: inbox items, memory proposals. */
  badge?: 'inbox' | 'memory'
}

export interface NavGroup {
  label: string
  items: readonly NavItem[]
}

/** The pages, grouped as the sidebar shows them; the tab bar and the palette read the same list. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Suivi',
    items: [
      { to: '/', label: 'Accueil', icon: 'home', key: 'h' },
      { to: '/board', label: 'Board', icon: 'board', key: 'b' },
      { to: '/inbox', label: 'Inbox', icon: 'inbox', key: 'i', badge: 'inbox' },
    ],
  },
  {
    label: 'Studio',
    items: [
      { to: '/unity', label: 'Unity', icon: 'unity', key: 'u' },
      { to: '/art', label: 'Art', icon: 'art', key: 'a' },
      { to: '/memory', label: 'Mémoire', icon: 'memory', key: 'm', badge: 'memory' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { to: '/budget', label: 'Budget', icon: 'budget', key: '$' },
      { to: '/settings', label: 'Réglages', icon: 'settings', key: 's' },
    ],
  },
]

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/** The four pages of the phone tab bar; the rest sits behind « Plus… ». */
export const TAB_ITEMS = NAV_ITEMS.filter((item) => ['/', '/board', '/inbox', '/unity'].includes(item.to))
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !TAB_ITEMS.includes(item))

/** Title of the page at `pathname`, for the top bar and the document title. */
export function pageTitle(pathname: string): string {
  if (pathname.startsWith('/issue/')) return 'Issue'
  return NAV_ITEMS.find((item) => item.to === pathname)?.label ?? 'aidp-studio'
}
