// Unified diff of one file, cut into lines for display. No syntax highlighting.

export type DiffLineKind = 'add' | 'del' | 'hunk' | 'ctx' | 'note'

export interface DiffLine {
  kind: DiffLineKind
  text: string
}

/** Lines shown before the « afficher tout » button. */
export const DIFF_LINE_CAP = 400
/** A file with more changed lines than this starts folded. */
export const FOLD_ABOVE_LINES = 80
/** Changed lines shown open in total; the files after that start folded. */
export const OPEN_BUDGET_LINES = 300
/** Files listed before the « afficher les autres » button. */
export const FILE_CAP = 60

export function parseDiff(patch: string): DiffLine[] {
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.map((text): DiffLine => {
    if (text.startsWith('@@')) return { kind: 'hunk', text }
    if (text.startsWith('\\')) return { kind: 'note', text }
    if (text.startsWith('+')) return { kind: 'add', text }
    if (text.startsWith('-')) return { kind: 'del', text }
    return { kind: 'ctx', text }
  })
}

export interface FoldInput {
  additions: number
  deletions: number
}

/** Which files start open: small ones, until the open budget is spent. */
export function initialOpen(files: readonly FoldInput[]): boolean[] {
  let spent = 0
  return files.map((file) => {
    const size = file.additions + file.deletions
    if (size > FOLD_ABOVE_LINES || spent + size > OPEN_BUDGET_LINES) return false
    spent += size
    return true
  })
}

const IMAGE_EXT = /\.(png|gif|webp|jpe?g)$/i
const BINARY_EXT = /\.(png|gif|webp|jpe?g|aseprite|ase|psd|ogg|wav|mp3|mp4|ttf|otf|dll|zip|fbx|bin)$/i

export const isImagePath = (path: string): boolean => IMAGE_EXT.test(path)
export const isBinaryPath = (path: string): boolean => BINARY_EXT.test(path)

export const STATUS_WORD: Record<string, string> = {
  added: 'ajouté',
  removed: 'supprimé',
  modified: 'modifié',
  renamed: 'renommé',
  copied: 'copié',
  changed: 'modifié',
}
