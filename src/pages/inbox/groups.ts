import { isBlockedStatus } from '../../api/f1queries'
import { needsDecision } from '../../api/queries'
import type { FlowDecision, InboxEntry, InboxGroups, Ticket } from '../../api/types'

/** `flow.human` detail reads `<ticket key> / <step id>`; anything else is not a flow decision. */
export function parseFlowDecision(entry: InboxEntry): FlowDecision | null {
  if (entry.kind !== 'flow.human' || !entry.detail) return null
  const [key, stepId] = entry.detail.split(/\s+\/\s+/, 2)
  if (!key || !stepId) return null
  return { entry, key: key.trim(), stepId: stepId.trim(), itemId: entry.fingerprint ?? null }
}

const isMerge = (stepId: string) => /merge/i.test(stepId)
const isBudget = (stepId: string) => /budget/i.test(stepId)

/**
 * Everything waiting for a human, in the groups of the page. A running session without question
 * is not a decision; a blocked issue is (and counts in the badge).
 */
export function groupInbox(entries: readonly InboxEntry[], tickets: readonly Ticket[]): InboxGroups {
  const groups: InboxGroups = { merges: [], budget: [], decisions: [], questions: [], others: [], blocked: [] }
  for (const entry of entries) {
    if (!needsDecision(entry)) continue
    const decision = parseFlowDecision(entry)
    if (decision) {
      if (isMerge(decision.stepId)) groups.merges.push(decision)
      else if (isBudget(decision.stepId)) groups.budget.push(decision)
      else groups.decisions.push(decision)
    } else if (entry.kind === 'gate') groups.questions.push(entry)
    else groups.others.push(entry)
  }
  groups.blocked = tickets.filter((ticket) => isBlockedStatus(ticket.status))
  return groups
}

export function inboxTotal(groups: InboxGroups): number {
  return (
    groups.merges.length +
    groups.budget.length +
    groups.decisions.length +
    groups.questions.length +
    groups.others.length +
    groups.blocked.length
  )
}
