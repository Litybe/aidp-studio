import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
}

const TOAST_MS = 5000
let toasts: readonly Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(next: readonly Toast[]): void {
  toasts = next
  for (const listener of listeners) listener()
}

/** A discreet message that leaves by itself after 5 s (one timeout per toast, no interval). */
export function showToast(text: string): void {
  const id = nextId++
  emit([...toasts, { id, text }])
  setTimeout(() => dismissToast(id), TOAST_MS)
}

export function dismissToast(id: number): void {
  emit(toasts.filter((toast) => toast.id !== id))
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => toasts,
  )
}
