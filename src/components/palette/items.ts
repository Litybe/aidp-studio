import type { Ticket } from '../../api/types'
import { ticketNumber } from '../../pages/board/columns'
import { NAV_ITEMS, type NavItem } from '../nav'
import type { IconName } from '../ui/Icon'

export type PaletteAction = 'sync' | 'dispatcher' | 'new-run'

export type PaletteItem =
  | { kind: 'page'; id: string; label: string; icon: IconName; hint: string; to: NavItem['to'] }
  | { kind: 'action'; id: string; label: string; icon: IconName; hint: string; action: PaletteAction }
  | { kind: 'ticket'; id: string; label: string; icon: IconName; hint: string; ticketKey: string }

export const MAX_TICKETS = 8

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Every word of the query appears somewhere in the text (accents and case ignored). */
export function matches(query: string, text: string): boolean {
  const haystack = normalize(text)
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function pageItems(): PaletteItem[] {
  return NAV_ITEMS.map((item) => ({
    kind: 'page',
    id: `page:${item.to}`,
    label: item.label,
    icon: item.icon,
    hint: `g ${item.key}`,
    to: item.to,
  }))
}

export function actionItems(dispatcherPaused: boolean): PaletteItem[] {
  return [
    { kind: 'action', id: 'action:new-run', label: 'Nouveau run…', icon: 'play', hint: 'action', action: 'new-run' },
    { kind: 'action', id: 'action:sync', label: 'Synchroniser GitHub', icon: 'github', hint: 'action', action: 'sync' },
    {
      kind: 'action',
      id: 'action:dispatcher',
      label: dispatcherPaused ? 'Reprendre le dispatcher' : 'Mettre le dispatcher en pause',
      icon: dispatcherPaused ? 'play' : 'pause',
      hint: 'action',
      action: 'dispatcher',
    },
  ]
}

export function ticketItems(tickets: readonly Ticket[], query: string): PaletteItem[] {
  const trimmed = query.trim()
  if (trimmed === '') return []
  const wanted = trimmed.replace(/^#/, '')
  const out: PaletteItem[] = []
  for (const ticket of tickets) {
    const number = ticketNumber(ticket)
    if (!(number.replace(/^#/, '').startsWith(wanted) || matches(trimmed, `${number} ${ticket.summary}`))) continue
    out.push({
      kind: 'ticket',
      id: `ticket:${ticket.key}`,
      label: ticket.summary,
      icon: 'doc',
      hint: number,
      ticketKey: ticket.key,
    })
    if (out.length >= MAX_TICKETS) break
  }
  return out
}

/** The list the palette shows for `query`: pages and actions filtered, then matching tickets. */
export function buildItems(query: string, tickets: readonly Ticket[], dispatcherPaused: boolean): PaletteItem[] {
  const fixed = [...pageItems(), ...actionItems(dispatcherPaused)]
  const trimmed = query.trim()
  const filtered = trimmed === '' ? fixed : fixed.filter((item) => matches(trimmed, item.label))
  return [...filtered, ...ticketItems(tickets, query)]
}
