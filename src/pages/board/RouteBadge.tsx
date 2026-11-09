import type { TicketRoute } from '../../api/types'
import { Icon, type IconName } from '../../components/ui/Icon'
import { ROUTE_ICON } from './columns'

const ROUTE_STYLE: Record<TicketRoute, { icon: IconName; className: string }> = {
  code: { icon: 'code', className: 'bg-sky-950/60 text-sky-300' },
  art: { icon: 'art', className: 'bg-fuchsia-950/60 text-fuchsia-300' },
  map: { icon: 'map', className: 'bg-emerald-950/60 text-emerald-300' },
  doc: { icon: 'doc', className: 'bg-amber-950/60 text-amber-300' },
}

/** The route of a ticket as a small tinted square with its icon; the label stays for readers. */
export function RouteBadge({ route, size = 'sm' }: { route: TicketRoute; size?: 'sm' | 'md' }) {
  const style = ROUTE_STYLE[route]
  const label = ROUTE_ICON[route].label
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded ${size === 'md' ? 'size-7' : 'size-5'} ${style.className}`}
      title={label}
      aria-label={`Route ${label}`}
    >
      <Icon name={style.icon} size={size === 'md' ? 15 : 12} />
    </span>
  )
}
