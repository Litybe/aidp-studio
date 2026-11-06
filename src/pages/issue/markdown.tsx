import { Fragment, type ReactNode } from 'react'

/** Artefacts above this size are shown as plain text: a light renderer is for notes, not megabytes. */
export const MARKDOWN_MAX_CHARS = 200_000

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g

/** Inline code, bold, italic and http(s) links. Nothing is injected as HTML. */
export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="rounded bg-slate-800 px-1 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part)
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener" className="text-sky-400 underline">
          {link[1]}
        </a>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string }

const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

/** Splits Markdown into blocks: headings, fenced code, lists, quotes, paragraphs (tables stay text). */
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }
    if (line.trimStart().startsWith('```')) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').trimStart().startsWith('```')) {
        body.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', text: body.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' })
      index += 1
      continue
    }
    const listPattern = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null
    if (listPattern) {
      const items: string[] = []
      while (index < lines.length && listPattern.test(lines[index] ?? '')) {
        items.push(listPattern.exec(lines[index] ?? '')?.[1] ?? '')
        index += 1
      }
      blocks.push({ type: 'list', ordered: listPattern === NUMBERED, items })
      continue
    }
    if (line.startsWith('>')) {
      const body: string[] = []
      while (index < lines.length && (lines[index] ?? '').startsWith('>')) {
        body.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: body.join(' ') })
      continue
    }
    const body: string[] = []
    while (index < lines.length) {
      const next = lines[index] ?? ''
      if (next.trim() === '' || next.trimStart().startsWith('```') || /^#{1,6}\s/.test(next) || BULLET.test(next) || NUMBERED.test(next)) break
      body.push(next)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: body.join(' ') })
  }
  return blocks
}

const HEADING = ['text-lg', 'text-base', 'text-sm', 'text-sm', 'text-xs', 'text-xs']

export function Markdown({ source }: { source: string }) {
  if (source.length > MARKDOWN_MAX_CHARS) {
    return <pre className="overflow-auto whitespace-pre-wrap text-xs text-slate-300">{source.slice(0, MARKDOWN_MAX_CHARS)}</pre>
  }
  return (
    <div className="space-y-2 text-sm text-slate-300">
      {parseMarkdown(source).map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <p key={index} role="heading" aria-level={block.level} className={`${HEADING[block.level - 1]} mt-3 font-semibold text-slate-100`}>
                {renderInline(block.text)}
              </p>
            )
          case 'code':
            return (
              <pre key={index} className="overflow-auto rounded bg-slate-900 p-2 font-mono text-xs">
                {block.text}
              </pre>
            )
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag key={index} className={`${block.ordered ? 'list-decimal' : 'list-disc'} pl-5`}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </Tag>
            )
          }
          case 'quote':
            return (
              <blockquote key={index} className="border-l-2 border-slate-700 pl-3 text-slate-400">
                {renderInline(block.text)}
              </blockquote>
            )
          default:
            return <p key={index}>{renderInline(block.text)}</p>
        }
      })}
    </div>
  )
}
