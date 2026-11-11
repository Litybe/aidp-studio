import type { QueryClient } from '@tanstack/react-query'
import { prefetchPage } from './loaders'

/** Hover and focus handlers of a navigation link: its chunk and main queries load before the click. */
export function prefetchProps(to: string, client: QueryClient) {
  const warm = () => prefetchPage(to, client)
  return { onMouseEnter: warm, onFocus: warm, onTouchStart: warm }
}
