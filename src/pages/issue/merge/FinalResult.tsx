import { useState } from 'react'
import { API_BASE } from '../../../api/client'
import { runFileUrl } from '../../../api/actions'
import type { PrFileEntry } from '../../../api/types'
import { AuthImage } from '../../../components/AuthImage'
import { useIsMobile } from '../../../lib/media'
import { useAllRunFiles } from '../tabs'
import { isImagePath, STATUS_WORD } from './diff'

/** Images shown before the « afficher les autres » button. */
export const IMAGE_CAP = 8
const MAX_ZOOM = 24
const ZOOM_BOX_DESKTOP = { width: 480, height: 360 }
const ZOOM_BOX_PHONE = { width: 300, height: 360 }

/** Whole-number zoom that fits the box: pixels stay square and crisp. 1 for an image that is already big. */
export function zoomFor(width: number, height: number, box = ZOOM_BOX_DESKTOP): number {
  if (width <= 0 || height <= 0) return 1
  return Math.max(1, Math.min(MAX_ZOOM, Math.floor(Math.min(box.width / width, box.height / height))))
}

/** The file as it is at a commit of the repository, through the daemon (the repository is private). */
export function headFileUrl(repo: string, sha: string, path: string): string {
  const raw = `https://raw.githubusercontent.com/${repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`
  return `${API_BASE}/github/asset?url=${encodeURIComponent(raw)}`
}

const PIXELATED = { imageRendering: 'pixelated' } as const

function ResultImage({ src, path, note }: { src: string; path: string; note?: string }) {
  const mobile = useIsMobile()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const scale = size ? zoomFor(size.width, size.height, mobile ? ZOOM_BOX_PHONE : ZOOM_BOX_DESKTOP) : 1
  const onLoad = (event: { currentTarget: HTMLImageElement }) =>
    setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
  return (
    <figure className="min-w-0 overflow-hidden rounded-md border border-line bg-card">
      <div className="grid max-h-[75vh] place-items-center overflow-y-auto bg-slate-600 p-3">
        <AuthImage
          src={src}
          alt={`Résultat final : ${path}`}
          onLoad={onLoad}
          style={{ ...PIXELATED, ...(size ? { width: size.width * scale } : {}), maxWidth: '100%', height: 'auto' }}
        />
      </div>
      <figcaption className="space-y-1.5 border-t border-line p-3 text-xs text-ink-muted">
        <p className="font-mono break-all text-ink-soft">{path}</p>
        <p>
          {size ? `${size.width} × ${size.height} px · zoom ×${scale}` : 'Chargement…'}
          {note ? ` · ${note}` : ''}
        </p>
        {size ? (
          <div>
            <p className="mb-1">Taille réelle (1×)</p>
            <div className="max-w-full overflow-hidden rounded-sm bg-slate-600 p-2">
              <AuthImage
                src={src}
                alt={`${path} à 1×`}
                style={{ ...PIXELATED, width: size.width, maxWidth: '100%', height: 'auto' }}
              />
            </div>
          </div>
        ) : null}
      </figcaption>
    </figure>
  )
}

function Stale({ runIds }: { runIds: readonly string[] }) {
  const { files, pending } = useAllRunFiles(runIds, true)
  const images = files.filter((file) => file.kind === 'png' || file.kind === 'gif').slice(-IMAGE_CAP)
  if (images.length === 0) return <p className="text-sm text-ink-faint">{pending ? 'Chargement…' : 'Aucune image dans les runs non plus.'}</p>
  return (
    <div className="space-y-2">
      <p className="rounded border border-st-running/50 bg-st-running/10 p-2 text-sm text-ink-soft">
        Rendus des runs : ils peuvent être périmés, la PR ne contient pas d'image.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {images.map((file) => (
          <ResultImage key={`${file.runId}/${file.path}`} src={runFileUrl(file.runId, file.path)} path={file.path} note="artefact de run" />
        ))}
      </div>
    </div>
  )
}

interface Props {
  repo: string
  sha: string
  files: readonly PrFileEntry[]
  runIds: readonly string[]
}

/** The images kept at the head of the PR branch, big, crisp, with their size and path. */
export function FinalResult({ repo, sha, files, runIds }: Props) {
  const [all, setAll] = useState(false)
  const images = files.filter((file) => isImagePath(file.filename) && file.status !== 'removed')
  if (images.length === 0) return <Stale runIds={runIds} />
  const shown = all ? images : images.slice(0, IMAGE_CAP)
  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${images.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {shown.map((file) => (
          <ResultImage
            key={file.filename}
            src={headFileUrl(repo, sha, file.filename)}
            path={file.filename}
            note={STATUS_WORD[file.status] ?? file.status}
          />
        ))}
      </div>
      {images.length > shown.length ? (
        <button
          type="button"
          className="min-h-10 rounded border border-line px-3 text-sm text-ink-soft hover:bg-raised"
          onClick={() => setAll(true)}
        >
          Afficher les {images.length - shown.length} autres images
        </button>
      ) : null}
    </div>
  )
}
