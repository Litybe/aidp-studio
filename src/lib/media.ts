import { useSyncExternalStore } from 'react'

/** Below Tailwind's `md`: phone layout (bottom tab bar, compact top bar). */
export const MOBILE_QUERY = '(max-width: 767.98px)'

function subscribe(listener: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const list = window.matchMedia(MOBILE_QUERY)
  list.addEventListener('change', listener)
  return () => list.removeEventListener('change', listener)
}

const snapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches

/** True on a phone-width viewport; follows rotation and resizing. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
