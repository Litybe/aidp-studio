import type { TicketPr } from '../../api/types'
import type { Tone } from '../../components/ui/classes'
import { Pill } from '../../components/ui/Pill'

export interface MergeBadge {
  label: string
  tone: Tone
  title: string
}

const CLOSED = /merged|closed/i

/** The conflict badge of a PR: `null` once the PR is merged or closed (nothing left to merge). */
export function mergeBadge(pr: TicketPr | undefined): MergeBadge | null {
  if (!pr || CLOSED.test(pr.state ?? '')) return null
  if (pr.mergeable === 'conflicting' || pr.mergeStateStatus === 'dirty') {
    return { label: 'Conflits', tone: 'danger', title: 'La PR a des conflits de merge avec sa branche de base' }
  }
  if (pr.mergeable === 'mergeable') {
    return { label: 'Mergeable', tone: 'ok', title: 'Aucun conflit avec la branche de base' }
  }
  return { label: 'Inconnu / en calcul', tone: 'muted', title: 'GitHub calcule encore la mergeabilité' }
}

/** `null` when the PR is up to date with its base (or the figure is unknown). */
export function behindLabel(pr: TicketPr | undefined): string | null {
  if (!pr || CLOSED.test(pr.state ?? '')) return null
  if (typeof pr.behindBy === 'number' && pr.behindBy > 0) {
    return `En retard de ${pr.behindBy} commit${pr.behindBy > 1 ? 's' : ''}`
  }
  return pr.mergeStateStatus === 'behind' ? 'En retard sur la base' : null
}

/** Merge conflict badge, plus the behind-base state when GitHub reports one. */
export function MergeStateBadge({ pr }: { pr: TicketPr | undefined }) {
  const badge = mergeBadge(pr)
  if (!badge) return null
  const behind = behindLabel(pr)
  return (
    <>
      <Pill tone={badge.tone} dot title={badge.title}>
        {badge.label}
      </Pill>
      {behind ? (
        <Pill tone="warn" title="La branche de base a avancé depuis la création de la PR">
          {behind}
        </Pill>
      ) : null}
    </>
  )
}
