import { describe, expect, it } from 'vitest'
import { formatTokens, formatUsd } from '../../lib/format'
import { costLabel } from './TicketCard'

describe('costLabel', () => {
  it('shows dollars and the totals tokens of the daemon route', () => {
    expect(costLabel({ costUsd: 12.5, totals: { totalTokens: 3_000_000 } })).toBe(`${formatUsd(12.5)} · ${formatTokens(3_000_000)}`)
  })

  it('falls back to tokens when there are no dollars', () => {
    expect(costLabel({ totals: { totalTokens: 4200 } })).toBe(formatTokens(4200))
    expect(costLabel({ costUsd: 0, totalTokens: 4200 })).toBe(formatTokens(4200))
  })

  it('is empty for an unspent ticket', () => {
    expect(costLabel(undefined)).toBe('')
    expect(costLabel({ totals: { totalTokens: 0 } })).toBe('')
  })
})
