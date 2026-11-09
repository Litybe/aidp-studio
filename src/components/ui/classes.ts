/**
 * Shared class strings: one look for every card, title, field and button of the app. Pages import
 * these instead of repeating the same Tailwind runs, so a visual change is made in one place.
 */

/** A content card: surface, hairline border, rounded corners. */
export const CARD = 'rounded-card border border-line bg-card p-4'
/** A card title (h2). */
export const H2 = 'mb-3 flex items-center gap-2 text-sm font-semibold text-ink'
/** A section label (h3, uppercase). */
export const H3 = 'text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint'

export const INPUT =
  'rounded-md border border-line-strong bg-canvas px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint hover:border-ink-faint focus:border-accent'
export const SELECT = `${INPUT} cursor-pointer pr-8`

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'
export const BUTTON = `${BUTTON_BASE} border-line-strong bg-card text-ink-muted hover:border-ink-faint hover:bg-raised hover:text-ink`
export const BUTTON_PRIMARY = `${BUTTON_BASE} border-accent-strong bg-accent-strong text-white hover:bg-accent`
export const BUTTON_SOFT = `${BUTTON_BASE} border-accent-strong/40 bg-accent-soft text-accent hover:bg-accent-strong/30`
export const BUTTON_DANGER = `${BUTTON_BASE} border-rose-900 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50`
export const BUTTON_GHOST = `${BUTTON_BASE} border-transparent text-ink-muted hover:bg-raised hover:text-ink`

/** A small rounded label. */
export const PILL = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap'

export type Tone = 'ok' | 'warn' | 'danger' | 'muted' | 'accent' | 'violet'

/** Pill colours per tone: a tinted surface, a readable text, a faint border. */
export const PILL_TONE: Record<Tone, string> = {
  ok: 'border-emerald-900 bg-emerald-950/50 text-emerald-300',
  warn: 'border-amber-900 bg-amber-950/50 text-amber-300',
  danger: 'border-rose-900 bg-rose-950/50 text-rose-300',
  muted: 'border-line bg-raised text-ink-muted',
  accent: 'border-accent-strong/40 bg-accent-soft text-accent',
  violet: 'border-violet-900 bg-violet-950/50 text-violet-300',
}

export const DOT_TONE: Record<Tone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  danger: 'bg-rose-400',
  muted: 'bg-slate-500',
  accent: 'bg-sky-400',
  violet: 'bg-violet-400',
}
