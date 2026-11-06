import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import type { Memory } from '../../api/types/memory'
import { KIND_LABEL, STATUS_LABEL } from './queries'

const ROW_HEIGHT = 44

const Row = memo(function Row({ memory, selected, onSelect }: { memory: Memory; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(memory.id)}
      aria-pressed={selected}
      className={`flex h-full w-full flex-col justify-center border-b border-slate-800 px-3 text-left hover:bg-slate-800/60 ${selected ? 'bg-slate-800' : ''}`}
    >
      <span className="truncate text-slate-100">{memory.title}</span>
      <span className="flex gap-2 text-xs text-slate-400">
        <span>{memory.id}</span>
        <span>{KIND_LABEL[memory.kind] ?? memory.kind}</span>
        <span className={memory.status === 'proposed' ? 'text-amber-300' : undefined}>{STATUS_LABEL[memory.status] ?? memory.status}</span>
        {memory.evidence ? <span>preuves {memory.evidence}</span> : null}
        {memory.confidence !== undefined ? <span>conf. {Math.round(memory.confidence * 100)}%</span> : null}
      </span>
    </button>
  )
})

/** Only the visible rows are in the DOM (`@tanstack/react-virtual`): hundreds of memories cost nothing. */
export function MemoryList({ memories, selectedId, onSelect }: { memories: readonly Memory[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const parentRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library -- the list itself is not memoised; the hook is used as documented
  const virtualizer = useVirtualizer({
    count: memories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => memories[index]?.id ?? index,
  })
  if (memories.length === 0) return <p className="text-xs text-slate-500">aucune mémoire pour ce filtre</p>
  return (
    <div ref={parentRef} className="h-[28rem] overflow-auto rounded border border-slate-800" role="list" aria-label="Mémoires" data-testid="memory-list">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const memory = memories[item.index]
          if (!memory) return null
          return (
            <div
              key={item.key}
              role="listitem"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: item.size, transform: `translateY(${item.start}px)` }}
            >
              <Row memory={memory} selected={memory.id === selectedId} onSelect={onSelect} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
