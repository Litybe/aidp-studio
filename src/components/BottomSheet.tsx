import { type ReactNode, useEffect, useRef } from 'react'

interface BottomSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Phone bottom sheet: dim backdrop (no blur), Escape or a tap outside closes, focus moves inside. */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[80dvh] overflow-auto rounded-t-xl border-t border-slate-700 bg-slate-900 p-3 pb-6 outline-none [&_button]:min-h-10 [&_button]:px-3 [&_button]:text-sm [&_input]:min-h-10 [&_select]:min-h-10"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button type="button" className="rounded px-3 text-slate-300 hover:bg-slate-800" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
