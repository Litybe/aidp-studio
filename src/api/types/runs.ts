// Native runs (`GET /api/runs/:id`, `/files`) and the session stream.

export type RunFileKind = 'md' | 'json' | 'png' | 'gif' | 'other'

/** `GET /api/runs/:id/files` (C11, F1 daemon). */
export interface RunFile {
  path: string
  size: number
  kind: RunFileKind
  stage?: string | null
}

export interface Assumption {
  choice?: string
  reason?: string
  rejected?: string
  rejected_alternative?: string
  rejectedAlternative?: string
  auto_answered?: boolean
  autoAnswered?: boolean
}

export interface RunDetail {
  status?: string
  autonomous?: boolean
  assumptions?: Assumption[]
}

export interface AskOption {
  label: string
  description?: string
}

export interface AskQuestion {
  question: string
  header?: string
  options?: AskOption[]
  multiSelect?: boolean
}

/** The part of a `SessionRecord` the UI reads. */
export interface SessionInfo {
  id: string
  status: string
  title?: string
  target?: string
  lastText?: string
  pendingQuestion?: { toolUseId: string; questions: AskQuestion[] } | null
}

export type StreamLineKind = 'text' | 'tool' | 'question' | 'result' | 'done'

export interface StreamLine {
  id: number
  kind: StreamLineKind
  text: string
}
