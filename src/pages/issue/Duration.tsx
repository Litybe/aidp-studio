import { elapsedLabel } from '../../lib/format'
import { useTicker } from '../../realtime/context'

export function Duration({ start, end }: { start: string | null | undefined; end: string | null | undefined }) {
  const running = Boolean(start) && !end
  const live = useTicker((now) => (running ? elapsedLabel(start, null, now) : ''))
  return <span className="tabular-nums">{running ? live : elapsedLabel(start, end, 0)}</span>
}
