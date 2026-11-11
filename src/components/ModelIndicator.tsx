import { Link } from '@tanstack/react-router'
import { memo } from 'react'
import type { MemoryModelState } from '../api/types/memoryModel'
import { MODEL_CARD_ID, useMemoryModel } from '../pages/memory/modelQueries'
import { StatusDot, type DotTone } from './StatusDot'

const TONE: Record<MemoryModelState, DotTone> = { stopped: 'muted', loading: 'warn', running: 'ok', error: 'danger' }
const TEXT: Record<MemoryModelState, string> = { stopped: 'arrêté', loading: 'chargement…', running: 'actif', error: 'erreur' }

/** `Embeddings : actif`; hidden while the daemon has no model route. Links to the card of the Mémoire page. */
export const ModelIndicator = memo(function ModelIndicator({ className = '' }: { className?: string }) {
  const model = useMemoryModel().data
  if (!model) return null
  return (
    <Link to="/memory" hash={MODEL_CARD_ID} className={`flex items-center gap-2 hover:text-ink ${className}`} data-testid="model-indicator" data-state={model.state}>
      <StatusDot tone={TONE[model.state]} />
      <span className="truncate text-ink-muted">Embeddings : {TEXT[model.state]}</span>
    </Link>
  )
})
