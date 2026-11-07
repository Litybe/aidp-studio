import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { authFetch, useHasToken } from '../api/auth'

const MAX_CONCURRENT = 3
let active = 0
const waiting: Array<() => void> = []

/** At most {@link MAX_CONCURRENT} image downloads at once; the rest wait their turn. */
function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}

function release(): void {
  const next = waiting.shift()
  if (next) next()
  else active -= 1
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string }

/**
 * `<img>` for an `/api` file. Without a token (loopback) the browser loads `src` directly. With a
 * token the browser cannot send `Authorization`, so the file is fetched through `authFetch` once the
 * image is near the viewport, shown from a blob URL, and the blob is revoked on unmount or source change.
 */
export function AuthImage({ src, alt, ...rest }: Props) {
  const hasToken = useHasToken()
  const ref = useRef<HTMLImageElement>(null)
  const [visible, setVisible] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hasToken) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasToken, src])

  useEffect(() => {
    if (!hasToken || !visible) return
    const controller = new AbortController()
    let url: string | null = null
    void (async () => {
      await acquire()
      try {
        if (controller.signal.aborted) return
        const response = await authFetch(src, { signal: controller.signal })
        if (!response.ok) return
        const blob = await response.blob()
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      } catch {
        // Aborted or unreachable: the placeholder stays.
      } finally {
        release()
      }
    })()
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
      setBlobUrl(null)
    }
  }, [hasToken, visible, src])

  if (!hasToken) return <img src={src} alt={alt} loading="lazy" decoding="async" {...rest} />
  return <img ref={ref} {...(blobUrl ? { src: blobUrl } : {})} alt={alt} decoding="async" {...rest} />
}
