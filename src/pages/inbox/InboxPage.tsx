import { useMemo } from 'react'
import { useInbox, useTickets } from '../../api/f1queries'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { groupInbox, inboxTotal } from './groups'
import { GroupHeading, groupRows, GROUPS } from './items'

export default function InboxPage() {
  const inbox = useInbox()
  const tickets = useTickets()
  const entries = inbox.data
  const list = tickets.data
  const groups = useMemo(() => groupInbox(entries ?? [], list ?? []), [entries, list])
  if (inbox.isPending) return <p className="text-ink-faint">Chargement…</p>
  if (inbox.isError) return <p className="text-rose-400">Inbox illisible : {inbox.error.message}</p>
  const total = inboxTotal(groups)
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Inbox"
        subtitle={total === 0 ? 'Tout ce qui attend une décision apparaît ici.' : `${total} ${total > 1 ? 'éléments attendent' : 'élément attend'} une décision.`}
      />
      {total === 0 ? <EmptyState title="Rien n'attend de décision." hint="Les merges, questions de session et issues bloquées arriveront ici." /> : null}
      {GROUPS.map((group) => {
        const count = groups[group.id].length
        if (count === 0) return null
        return (
          <section key={group.id} aria-label={group.title} className="space-y-2">
            <GroupHeading group={group} count={count} />
            <ul className="space-y-2">{groupRows(groups, group.id)}</ul>
          </section>
        )
      })}
    </div>
  )
}
