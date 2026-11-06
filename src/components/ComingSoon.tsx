/** A route the daemon does not serve yet (404): discreet, never blocking. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <p className="rounded border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500" data-testid="coming-soon">
      {what} : bientôt disponible
    </p>
  )
}
