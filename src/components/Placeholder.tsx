import type { ReactNode } from 'react'

/** A page of the skeleton: its title, what lands in which lot, optional live details. */
export function Placeholder({ title, lot, children }: { title: string; lot: string; children?: ReactNode }) {
  return (
    <section className="max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
      <p className="mt-1 text-slate-400">{lot}</p>
      {children ? <div className="mt-4 text-slate-300">{children}</div> : null}
    </section>
  )
}
