import type { ReactNode } from 'react'

/** A page of the skeleton: its title, what lands in which lot, optional live details. */
export function Placeholder({ title, lot, children }: { title: string; lot: string; children?: ReactNode }) {
  return (
    <section className="max-w-3xl">
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-ink-muted">{lot}</p>
      {children ? <div className="mt-4 text-ink-soft">{children}</div> : null}
    </section>
  )
}
