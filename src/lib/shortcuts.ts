import { useEffect, useRef } from 'react'
import { NAV_ITEMS, type NavItem } from '../components/nav'

/** A key pressed inside a field or a dialog is typing, not a shortcut. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('[role="dialog"]')) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Second key of a `g` chord must follow within this window (compared on the next key: no timer). */
export const CHORD_MS = 1500

export interface ShortcutHandlers {
  openPalette: () => void
  go: (to: NavItem['to']) => void
}

export type ShortcutResult = { kind: 'palette' } | { kind: 'go'; to: NavItem['to'] } | { kind: 'chord' } | null

/**
 * Pure part of the shortcut logic, so it is testable: `Ctrl/Cmd+K` or `/` opens the palette, `g` then a
 * page key navigates. `pendingSince` is the time of the last lone `g`, or null.
 */
export function resolveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  pendingSince: number | null,
  now: number,
): ShortcutResult {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') return { kind: 'palette' }
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (pendingSince !== null && now - pendingSince <= CHORD_MS) {
    const item = NAV_ITEMS.find((candidate) => candidate.key === event.key.toLowerCase() || candidate.key === event.key)
    if (item) return { kind: 'go', to: item.to }
  }
  if (event.key === 'g') return { kind: 'chord' }
  if (event.key === '/' || event.key === '?') return { kind: 'palette' }
  return null
}

/** Installs the global shortcuts for the lifetime of the layout. */
export function useGlobalShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })
  useEffect(() => {
    let pendingSince: number | null = null
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const palette = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (!palette && isEditable(event.target)) return
      const result = resolveShortcut(event, pendingSince, Date.now())
      pendingSince = result?.kind === 'chord' ? Date.now() : null
      if (!result || result.kind === 'chord') return
      event.preventDefault()
      if (result.kind === 'palette') ref.current.openPalette()
      else ref.current.go(result.to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
