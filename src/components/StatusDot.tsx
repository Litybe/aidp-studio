export type DotTone = 'ok' | 'warn' | 'danger' | 'muted'

const TONE: Record<DotTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-400',
  danger: 'bg-rose-500',
  muted: 'bg-slate-500',
}

/** A static dot: no pulse, no glow. */
export function StatusDot({ tone }: { tone: DotTone }) {
  return <span aria-hidden="true" className={`inline-block size-2 rounded-full ${TONE[tone]}`} />
}
