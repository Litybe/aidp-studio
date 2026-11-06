// Art gallery: tickets, flows and `GET /api/runs/:id/files` (C11, F1 daemon).

export type RunFileKind = 'md' | 'json' | 'png' | 'gif' | 'other'

export interface RunFile {
  path: string
  size: number
  kind: RunFileKind
  stage?: string
}

/** The part of a ticket of `GET /api/tickets` the gallery needs. */
export interface ArtTicket {
  key: string
  title?: string
  route?: string
  githubNumber?: number
  flowSummary?: { flowKey: string; status?: string } | null
}

/** The part of `GET /api/flows/:key` the gallery needs: effect id to native run id. */
export interface FlowSessions {
  sessions?: Record<string, string>
}

export interface ArtImage {
  runId: string
  file: RunFile
}
