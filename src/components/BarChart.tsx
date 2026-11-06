import { memo } from 'react'

export interface BarItem {
  label: string
  value: number
}

const NUMBER = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatTokens(value: number): string {
  return NUMBER.format(value)
}

/** Bar widths in percent of the largest value (0 when every value is 0). */
export function barWidths(items: readonly BarItem[]): number[] {
  const max = Math.max(0, ...items.map((item) => item.value))
  return items.map((item) => (max > 0 ? Math.round((Math.max(0, item.value) / max) * 1000) / 10 : 0))
}

/** Horizontal bars in plain SVG: no library, no animation, nothing redrawn but on new data. */
export const BarChart = memo(function BarChart({
  items,
  ariaLabel,
  format = formatTokens,
}: {
  items: readonly BarItem[]
  ariaLabel: string
  format?: (value: number) => string
}) {
  if (items.length === 0) return <p className="text-xs text-slate-500">aucune donnée</p>
  const widths = barWidths(items)
  return (
    <ul className="flex flex-col gap-1" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <li key={item.label} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-slate-300" title={item.label}>
            {item.label}
          </span>
          <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-2 w-full" role="img" aria-label={`${item.label} : ${format(item.value)}`}>
            <rect x="0" y="0" width="100" height="6" className="fill-slate-800" />
            <rect x="0" y="0" width={widths[index]} height="6" className="fill-sky-500" data-testid="bar" />
          </svg>
          <span className="text-right tabular-nums text-slate-200">{format(item.value)}</span>
        </li>
      ))}
    </ul>
  )
})
