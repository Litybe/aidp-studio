import type { Ticket } from '../../api/types'
import { buildItems, matches, MAX_TICKETS } from './items'

const ticket = (n: number, summary: string): Ticket => ({ key: `GH-${n}`, summary, status: 'todo', githubNumber: n })

describe('palette items', () => {
  it('ignores case and accents when matching', () => {
    expect(matches('reglages', 'Réglages')).toBe(true)
    expect(matches('BOARD', 'Board')).toBe(true)
    expect(matches('dash air', '#12 Dash en l’air')).toBe(true)
    expect(matches('unity', 'Budget')).toBe(false)
  })

  it('lists every page and action without a query, and no ticket', () => {
    const items = buildItems('', [ticket(12, 'Dash')], false)
    expect(items.filter((item) => item.kind === 'page')).toHaveLength(8)
    expect(items.filter((item) => item.kind === 'action').map((item) => item.label)).toEqual([
      'Nouveau run…',
      'Synchroniser GitHub',
      'Mettre le dispatcher en pause',
    ])
    expect(items.filter((item) => item.kind === 'ticket')).toHaveLength(0)
  })

  it('finds a ticket by number prefix or by words of its title, capped', () => {
    const tickets = [ticket(12, 'Dash en l’air'), ticket(120, 'Sprite du héros'), ticket(7, 'Salle du boss')]
    expect(buildItems('#12', tickets, false).filter((item) => item.kind === 'ticket').map((item) => item.hint)).toEqual(['#12', '#120'])
    expect(buildItems('boss', tickets, false).filter((item) => item.kind === 'ticket').map((item) => item.hint)).toEqual(['#7'])
    const many = Array.from({ length: MAX_TICKETS + 5 }, (_, index) => ticket(index, `Carte ${index}`))
    expect(buildItems('carte', many, false).filter((item) => item.kind === 'ticket')).toHaveLength(MAX_TICKETS)
  })

  it('offers to resume a paused dispatcher', () => {
    expect(buildItems('dispatcher', [], true).map((item) => item.label)).toEqual(['Reprendre le dispatcher'])
  })
})
