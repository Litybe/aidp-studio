import { useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useTickets } from '../../api/f1queries'
import { useDispatcherPaused } from '../../api/queries'
import { showToast } from '../../lib/toast'
import { Icon } from '../ui/Icon'
import { buildItems, type PaletteAction, type PaletteItem } from './items'

const NO_TICKETS: never[] = []

const GROUP_LABEL: Record<PaletteItem['kind'], string> = { page: 'Pages', action: 'Actions', ticket: 'Issues' }

interface CommandPaletteProps {
  onClose: () => void
  /** « Nouveau run… » opens a dialog the layout owns. */
  onNewRun: () => void
}

/**
 * Ctrl K: type to jump to a page or an issue (`#214`, a word of the title), or run a global action.
 * Arrow keys move, Enter picks, Escape closes. Its own chunk: loaded on first use.
 */
export default function CommandPalette({ onClose, onNewRun }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const tickets = useTickets().data ?? NO_TICKETS
  const paused = useDispatcherPaused()
  const sync = useApiAction(() => apiPost(routes.ticketsSync))
  const dispatcher = useApiAction((verb: 'pause' | 'resume') => apiPost(routes.dispatcher(verb), verb === 'pause' ? { paused: true } : undefined))
  const items = useMemo(() => buildItems(query, tickets, paused), [query, tickets, paused])
  const active = items[Math.min(index, Math.max(0, items.length - 1))]

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    input.current?.focus()
    return () => opener?.focus()
  }, [])

  const runAction = (action: PaletteAction) => {
    if (action === 'new-run') onNewRun()
    else if (action === 'sync') {
      sync.run()
      showToast('Synchronisation GitHub demandée.')
    } else {
      dispatcher.run(paused ? 'resume' : 'pause')
      showToast(paused ? 'Dispatcher relancé.' : 'Dispatcher mis en pause.')
    }
  }

  const pick = (item: PaletteItem | undefined) => {
    if (!item) return
    onClose()
    if (item.kind === 'page') void navigate({ to: item.to })
    else if (item.kind === 'ticket') void navigate({ to: '/issue/$key', params: { key: item.ticketKey } })
    else runAction(item.action)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((value) => (items.length === 0 ? 0 : (value + 1) % items.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((value) => (items.length === 0 ? 0 : (value - 1 + items.length) % items.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Rechercher ou agir" className="w-full max-w-lg overflow-hidden rounded-card border border-line-strong bg-card">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={16} className="text-ink-faint" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={active?.id}
            aria-label="Rechercher une page, une issue ou une action"
            placeholder="Page, #issue, action…"
            autoComplete="off"
            spellCheck={false}
            className="h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIndex(0)
            }}
            onKeyDown={onKeyDown}
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-ink-faint">Aucun résultat.</li> : null}
          {items.map((item, position) => {
            const heading = items[position - 1]?.kind !== item.kind ? GROUP_LABEL[item.kind] : null
            const selected = item === active
            return (
              <li key={item.id} role="presentation">
                {heading ? <p className="px-2.5 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">{heading}</p> : null}
                <button
                  type="button"
                  role="option"
                  id={item.id}
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ${selected ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'}`}
                  onMouseEnter={() => setIndex(items.indexOf(item))}
                  onClick={() => pick(item)}
                >
                  <Icon name={item.icon} size={15} className={selected ? 'text-accent' : 'text-ink-faint'} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-faint">{item.hint}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[0.6875rem] text-ink-faint">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> naviguer
          </span>
          <span>
            <kbd>↵</kbd> ouvrir
          </span>
          <span>
            <kbd>g</kbd> puis <kbd>b</kbd> Board, <kbd>i</kbd> Inbox, <kbd>h</kbd> Accueil…
          </span>
        </div>
      </div>
    </div>
  )
}
