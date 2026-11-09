import { PageHeader } from '../../components/ui/PageHeader'
import { memo, useState } from 'react'
import type { ArtImage, ArtTicket } from '../../api/types/art'
import { useHasToken } from '../../api/auth'
import { AuthImage } from '../../components/AuthImage'
import { Async } from '../../components/Async'
import { ComingSoon } from '../../components/ComingSoon'
import { isMissing } from '../../api/send'
import { formatBytes } from '../../lib/format'
import { ticketLabel } from '../unity/queries'
import { runFileUrl, useArtTickets, useIssueImages } from './queries'

/** Pixel art must stay crisp: no smoothing, lazy decoding, size kept to avoid layout jumps. */
const Thumb = memo(function Thumb({ image }: { image: ArtImage }) {
  const name = image.file.path.split('/').pop() ?? image.file.path
  // A plain link cannot send the token: with one, the thumbnail is shown without the open-in-tab link.
  const hasToken = useHasToken()
  return (
    <figure className="flex w-32 flex-col gap-1">
      <a {...(hasToken ? {} : { href: runFileUrl(image.runId, image.file.path) })} target="_blank" rel="noreferrer" className="block rounded-card border border-line bg-canvas p-1">
        <AuthImage
          src={runFileUrl(image.runId, image.file.path)}
          alt={name}
          width={120}
          height={120}
          style={{ imageRendering: 'pixelated' }}
          className="h-[120px] w-[120px] object-contain"
        />
      </a>
      <figcaption className="truncate text-xs text-ink-muted" title={image.file.path}>
        {name} · {formatBytes(image.file.size)}
        {image.file.stage ? ` · ${image.file.stage}` : ''}
      </figcaption>
    </figure>
  )
})

function Gallery({ ticket }: { ticket: ArtTicket }) {
  const { images, loading, flow, noFlow } = useIssueImages(ticket, true)
  if (noFlow) return <p className="text-xs text-ink-faint">aucun flow pour cette issue</p>
  if (flow.isError) return isMissing(flow.error) ? <ComingSoon what="Flow de l'issue" /> : <p role="alert" className="text-xs text-rose-400">{flow.error instanceof Error ? flow.error.message : "erreur"}</p>
  if (loading) return <p className="text-xs text-ink-faint">chargement…</p>
  if (images.length === 0) return <p className="text-xs text-ink-faint">aucune image produite (ou fichiers pas encore servis par le daemon)</p>
  return (
    <div className="flex flex-wrap gap-3" aria-label={`Images de ${ticketLabel(ticket.key)}`}>
      {images.map((image) => (
        <Thumb key={`${image.runId}/${image.file.path}`} image={image} />
      ))}
    </div>
  )
}

const IssueCard = memo(function IssueCard({ ticket }: { ticket: ArtTicket }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-card border border-line bg-card/40 p-3" aria-label={ticketLabel(ticket.key)}>
      <button type="button" className="flex w-full items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="font-semibold text-ink">{ticketLabel(ticket.key)}</span>
        <span className="truncate text-ink-soft">{ticket.title ?? ''}</span>
        {ticket.flowSummary?.status ? <span className="ml-auto text-xs text-ink-muted">{ticket.flowSummary.status}</span> : null}
      </button>
      {open ? (
        <div className="mt-3">
          <Gallery ticket={ticket} />
        </div>
      ) : null}
    </section>
  )
})

export default function ArtPage() {
  const query = useArtTickets()
  return (
    <section className="flex max-w-5xl flex-col gap-3">
      <PageHeader title="Art" />
      <Async query={query} what="Galerie art">
        {(tickets) =>
          tickets.length === 0 ? (
            <p className="text-xs text-ink-faint">aucune issue de route art</p>
          ) : (
            tickets.map((ticket) => <IssueCard key={ticket.key} ticket={ticket} />)
          )
        }
      </Async>
    </section>
  )
}
