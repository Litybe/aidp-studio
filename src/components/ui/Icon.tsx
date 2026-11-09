import type { SVGProps } from 'react'

/** Hand-written 24-grid outline icons (stroke 1.75): no icon library, each one is a few path commands. */
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5 10v10h14V10M10 20v-6h4v6',
  board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v7h-4z',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z',
  unity: 'M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  budget: 'M4 19h16M6 15l4-5 4 3 4-6M18 7h2V5',
  memory: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 7h8M8 11h8M8 15h5',
  art: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-10zM8 8h.01M12 6h.01M16 8h.01M7 12h.01',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 5v14l12-7z',
  pause: 'M8 5v14M16 5v14',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  check: 'm5 12 5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 3 2 21h20zM12 10v5M12 18h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  github: 'M12 2a10 10 0 0 0-3 19.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1.1-1.4-1.4-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5a4 4 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a4 4 0 0 1 1 2.7c0 3.9-2.4 4.8-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z',
  chevronLeft: 'm15 5-7 7 7 7',
  chevronRight: 'm9 5 7 7-7 7',
  chevronDown: 'm6 9 6 6 6-6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  code: 'm8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  merge: 'M7 4v16M7 8a9 9 0 0 0 9 4M16 12h1M17 12a1 1 0 1 0 0 .01',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
} as const

export type IconName = keyof typeof PATHS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Size in px (default 16). */
  size?: number
}

export function Icon({ name, size = 16, className = '', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
