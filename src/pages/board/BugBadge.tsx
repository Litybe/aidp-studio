/** Red « BUG » tag of a bug ticket: bugs run in their own lane and are tested first. */
export function BugBadge() {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded bg-red-950/70 px-1.5 text-[10px] font-semibold tracking-wide text-red-300"
      title="Bug : lane dédiée, testé en priorité"
      aria-label="Bug"
    >
      BUG
    </span>
  )
}
