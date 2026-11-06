import { useEffect, useState } from 'react'
import { API_BASE } from '../../api/client'
import type { StreamLine, StreamLineKind } from '../../api/types'
import { Ring } from '../../lib/ring'
import { documentVisibility } from '../../lib/visibility'

/** The stream keeps the last lines only: RAM stays flat however long a session runs. */
export const STREAM_CAPACITY = 300
/** One line is cut past this size (a tool result can be huge). */
export const LINE_MAX_CHARS = 600

const clip = (text: string): string => (text.length > LINE_MAX_CHARS ? `${text.slice(0, LINE_MAX_CHARS)}…` : text)

interface Block {
  type?: string
  text?: string
  name?: string
  input?: unknown
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

/** Turns one session event (stream-json, as the daemon forwards it) into display lines. */
export function linesOfEvent(data: unknown): Omit<StreamLine, 'id'>[] {
  const event = asRecord(data)
  if (!event) return []
  const type = event['type']
  if (type === 'done') return [{ kind: 'done', text: `session terminée (${String(event['status'] ?? '?')})` }]
  if (type === 'result') {
    const result = typeof event['result'] === 'string' ? event['result'] : ''
    return result ? [{ kind: 'result', text: clip(result) }] : []
  }
  if (type === 'assistant') {
    const content = asRecord(event['message'])?.['content']
    if (!Array.isArray(content)) return []
    const out: Omit<StreamLine, 'id'>[] = []
    for (const raw of content as Block[]) {
      if (raw.type === 'text' && raw.text) out.push({ kind: 'text', text: clip(raw.text) })
      else if (raw.type === 'tool_use') {
        const kind: StreamLineKind = raw.name === 'AskUserQuestion' ? 'question' : 'tool'
        out.push({ kind, text: raw.name ?? 'outil' })
      }
    }
    return out
  }
  if (typeof event['text'] === 'string' && event['text']) return [{ kind: 'text', text: clip(event['text']) }]
  return []
}

/** Pure ring + counter, testable without a browser. */
export class StreamBuffer {
  private readonly ring = new Ring<StreamLine>(STREAM_CAPACITY)
  private nextId = 0
  push(lines: readonly Omit<StreamLine, 'id'>[]): void {
    for (const line of lines) {
      this.ring.push({ ...line, id: this.nextId })
      this.nextId += 1
    }
  }
  snapshot(): StreamLine[] {
    return this.ring.toArray()
  }
  get total(): number {
    return this.nextId
  }
}

export interface StreamState {
  lines: StreamLine[]
  status: 'idle' | 'open' | 'ended' | 'unavailable'
}

const FLUSH_MS = 300

/**
 * Follows `GET /api/sessions/:id/stream` (SSE). Lines go into a bounded ring and reach React at
 * most every 300 ms; a hidden tab closes the stream (no work in the background) and a visible
 * tab reopens it (the daemon replays what was recorded). No reconnect loop on error.
 */
export function useSessionStream(sessionId: string | null, enabled: boolean): StreamState {
  const [state, setState] = useState<StreamState>({ lines: [], status: 'idle' })

  useEffect(() => {
    if (!enabled || sessionId === null) return undefined
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let status: StreamState['status'] = 'open'
    let buffer = new StreamBuffer()

    const publish = () => {
      timer = null
      setState({ lines: buffer.snapshot(), status })
    }
    const schedule = () => {
      timer ??= setTimeout(publish, FLUSH_MS)
    }
    const close = () => {
      source?.close()
      source = null
    }
    const open = () => {
      buffer = new StreamBuffer()
        status = 'open'
      source = new EventSource(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/stream`)
      source.onmessage = (message: MessageEvent<string>) => {
        try {
          const lines = linesOfEvent(JSON.parse(message.data) as unknown)
          buffer.push(lines)
          if (lines.some((line) => line.kind === 'done')) {
            status = 'ended'
            close()
          }
        } catch {
          return
        }
        schedule()
      }
      source.onerror = () => {
        status = buffer.total > 0 ? 'ended' : 'unavailable'
        close()
        schedule()
      }
      schedule()
    }
    const onHidden = (hidden: boolean) => {
      if (hidden) {
        close()
      } else if (source === null && status === 'open') {
        open()
      }
    }
    if (!documentVisibility.isHidden()) open()
    const unsubscribe = documentVisibility.subscribe(onHidden)
    return () => {
      unsubscribe()
      close()
      if (timer !== null) clearTimeout(timer)
    }
  }, [sessionId, enabled])

  return state
}
