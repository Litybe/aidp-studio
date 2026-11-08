// Merge overview: the PR files and diffs (`GET /api/prs/files`, `/api/prs/file-diff`).

/** One file of the PR as `GET /api/prs/files` serves it. `patch` is null when missing or too big. */
export interface PrFileEntry {
  filename: string
  status: string
  additions: number
  deletions: number
  patch: string | null
  previousFilename: string | null
  sha: string | null
  tooLarge: boolean
}

/** `GET /api/prs/files?repo=&number=`: one page of 100 files. */
export interface PrFilesPage {
  files: PrFileEntry[]
  hasMore: boolean
  page: number
  perPage: number
}

/** `GET /api/prs/file-diff?repo=&number=&path=`. */
export interface PrFileDiff {
  path: string
  diff: string
}
