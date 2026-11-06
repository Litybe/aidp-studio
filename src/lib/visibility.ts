/** Whether the tab is hidden, and its changes. Injected so tests drive it by hand. */
export interface VisibilitySource {
  isHidden(): boolean
  subscribe(listener: (hidden: boolean) => void): () => void
}

/** The real tab visibility (`document.visibilityState` and `visibilitychange`). */
export const documentVisibility: VisibilitySource = {
  isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  subscribe(listener) {
    const onChange = () => listener(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  },
}
