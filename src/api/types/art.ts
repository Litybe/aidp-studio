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

/** A picture of an art run, from `GET /api/art/assets`. */
export interface ArtAssetImage {
  path: string
  size: number
  kind: RunFileKind
  stage: string
}

/** One art run of `GET /api/art/assets`: finished or not, with its pictures. */
export interface ArtAssetRun {
  runId: string
  templateId: string
  status: string
  ticket?: string
  startedAt: string
  endedAt?: string
  /** Review mark out of 10, when a review wrote one. */
  score?: number
  cover: ArtAssetImage
  images: ArtAssetImage[]
}

export interface ArtAssetsPage {
  runs: ArtAssetRun[]
  /** Cursor (`before`) of the next page, `null` on the last one. */
  next: string | null
}
