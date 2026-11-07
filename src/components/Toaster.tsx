import { dismissToast, useToasts } from '../lib/toast'

/** Bottom-right toasts; renders nothing while there is none. */
export function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-xs text-slate-100"
          onClick={() => dismissToast(toast.id)}
        >
          {toast.text}
        </button>
      ))}
    </div>
  )
}
