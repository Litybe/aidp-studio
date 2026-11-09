/** A route the daemon does not serve yet (404): discreet, never blocking. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <p className="rounded-card border border-dashed border-line px-3 py-2 text-xs text-ink-faint" data-testid="coming-soon">
      {what} : bientôt disponible
    </p>
  )
}
