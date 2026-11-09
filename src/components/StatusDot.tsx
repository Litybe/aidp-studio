export type DotTone = 'ok' | 'warn' | 'danger' | 'muted'

const TONE: Record<DotTone, string> = {
  ok: 'bg-emerald-400 ring-emerald-400/25',
  warn: 'bg-amber-400 ring-amber-400/25',
  danger: 'bg-rose-400 ring-rose-400/25',
  muted: 'bg-slate-500 ring-slate-500/20',
}

/** A static dot with a soft halo: no pulse, no glow, no animation. */
export function StatusDot({ tone }: { tone: DotTone }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ring-3 ${TONE[tone]}`} />
}
