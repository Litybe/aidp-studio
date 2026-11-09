import { dismissToast, useToasts } from '../lib/toast'
import { Icon } from './ui/Icon'

/** Bottom-right toasts; renders nothing while there is none. */
export function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div className="fixed right-4 bottom-20 z-50 flex flex-col gap-2 md:bottom-4" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="flex items-center gap-2 rounded-card border border-line-strong bg-raised px-3 py-2 text-left text-xs text-ink shadow-lg shadow-black/40"
          onClick={() => dismissToast(toast.id)}
        >
          <Icon name="check" size={14} className="text-emerald-400" />
          {toast.text}
        </button>
      ))}
    </div>
  )
}
