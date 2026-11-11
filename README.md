# aidp-studio

Front of the aidp gateway for a solo Unity game (`D:\AIDP\src\aidp\docs\PLAN-GAMEDEV.md`, §7).
**The front displays, the daemon decides**: it only calls the daemon API (`/api/*`) and its SSE
stream; no direct call to `gh`, Unity or Pixellab.

Stack: Vite, React, TypeScript strict, Tailwind, TanStack Query, TanStack Router, Vitest and
Testing Library.

## Setup (nothing on C:)

Node is the one already installed (`C:\Program Files\nodejs`); nothing is installed globally.
`.npmrc` points the npm cache at `D:\DevTools\npm-cache`; `node_modules` stays in this repository.

```powershell
npm install
```

## Develop

Start the daemon (`aidp gateway serve`, `127.0.0.1:3001`), then:

```powershell
npm run dev        # http://127.0.0.1:5173, /api and the SSE proxied to 127.0.0.1:3001
```

## Check and build

```powershell
npm run typecheck  # tsc -b, strict
npm run lint       # ESLint, polling forbidden
npm test           # Vitest
npm run build      # dist/, with .br and .gz next to each text asset
```

## Serve through the daemon

No Node server in normal use: the daemon serves `dist/` itself, `/api` first, `index.html` for every
client route, precompressed `.br`/`.gz` when the browser accepts them.

```powershell
aidp gateway serve --ui-dir D:\AIDP\src\aidp-studio\dist   # or AIDP_UI_DIR
```

Then open `http://127.0.0.1:3001/`. A UI action that `POST`s needs
`AIDP_ALLOWED_ORIGINS=http://127.0.0.1:3001` on the daemon (and `http://127.0.0.1:5173` in dev).

## Layout

| Path | Holds |
|---|---|
| `src/api/` | `types.ts` (hand-written from `docs/gateway-api.md`), `client.ts` (typed `fetch`, base `/api`), `queries.ts` (query keys, Query client, hooks) |
| `src/realtime/` | `events.ts` (the single `EventSource`, backoff, resume with `?since=`), `invalidation.ts` (event type → query keys, batching), `runtime.ts`, `context.ts` |
| `src/lib/` | `gauge.ts` (5 h / 7 d gauges), `ticker.ts` (the 1 Hz clock), `ring.ts`, `store.ts`, `visibility.ts` |
| `src/components/ui/` | Design tokens in use: `classes.ts` (card, title, field and button class strings), `Icon` (inline SVG set), `Card`, `PageHeader`, `Pill`, `EmptyState` |
| `src/components/` | Sidebar (grouped, collapsible), top bar, phone tab bar, gauges, indicators, `nav.ts` (the one list of pages), `palette/` (Ctrl K) |
| `src/pages/` | One lazy chunk per page: Accueil (`home/`), Board, Issue, Inbox, Unity, Budget, Mémoire, Art, Réglages |

## Navigation

- **Accueil** (`/`) is the landing page: what waits for a decision, the active flows with their step and
  elapsed time, the pipeline (tickets per column), the 5 h / 7 d windows with the dispatcher verdict, the
  Unity editor and lock. Every number links to the page that acts on it; the first inbox items carry
  their one-click actions (merge, approve, answer, unblock).
- **Sidebar** (desktop): pages grouped as Suivi / Studio / Pilotage, badges for the inbox and the memory
  proposals, daemon and Unity state at the bottom. « Replier » keeps icons only (remembered in
  `localStorage`). On the phone, a bottom tab bar holds Accueil, Board, Inbox, Unity and « Plus… ».
- **Palette** (`Ctrl K`, `/`): jump to a page, an issue (`#214` or a word of its title) or run a global
  action (Sync GitHub, pause / resume the dispatcher, Nouveau run). Its chunk loads on first use.
- **Chords**: `g` then `h` Accueil, `b` Board, `i` Inbox, `u` Unity, `a` Art, `m` Mémoire, `$` Budget,
  `s` Réglages. Nothing fires while a field or a dialog has the focus.
- **Colours**: tokens in `src/index.css` (`@theme`): surfaces `canvas` → `panel` → `card` → `raised`,
  borders `line` / `line-strong`, text `ink` / `ink-soft` / `ink-muted` / `ink-faint`, one `accent`.
  Columns, pills and dots share the same four tones (ok, warn, danger, muted) plus accent and violet.

## Performance

The front runs beside the Unity editor and games: RAM, CPU and GPU at the strict minimum. These
rules bind every lot (F1, F2); `src/main.tsx` repeats them.

1. **Rendering / GPU.** No infinite animation. No `backdrop-filter`, `filter`, `blur`, animated
   shadow or gradient, `will-change`, canvas or WebGL. Gauges are static divs or SVG. Transitions
   are short and only on interaction; `prefers-reduced-motion` turns them off. System font, no
   webfont, no heavy image.
2. **Idle CPU ≈ 0.** No polling (ESLint refuses `setInterval` and `refetchInterval`): data refreshes
   through SSE only. SSE invalidations are batched in a 300 ms window, deduplicated by key. One
   global countdown timer (`Ticker`), 1 Hz at most, stopped while the tab is hidden; a hidden tab
   renders nothing, its invalidations wait and are replayed on return, and a broken stream waits
   for the tab before reconnecting. TanStack Query: `staleTime` infinite (data lives by SSE),
   `refetchOnWindowFocus: false`, no `refetchInterval`, `retry` bounded to 2 and none when the
   daemon is unreachable.
3. **RAM.** `gcTime` 30 min (tab switches render from the cache; SSE invalidations keep it fresh). Every stream buffer is a bounded `Ring` (events, later the journal and the
   session stream). Long lists are virtualised with `@tanstack/react-virtual` once F1 has them. No
   global store duplicating the Query cache. No Devtools in the production build.
4. **Bundle.** One chunk per route (`lazyRouteComponent`). No heavy dependency (no chart lib,
   moment, lodash: `Intl` for dates). Tailwind keeps only the classes used. `build.target`
   `es2022`, no production sourcemap. Budget: initial JS ≤ 150 KB gzip.
5. **React.** List and card components are `memo`; queries read through narrow `select`s; the only
   context holds constant services, so an SSE event never re-renders the tree. Countdowns read the
   ticker through a selector returning a label, so they re-render when the label changes (once a
   minute), not every second.
6. **Daemon side.** `aidp gateway serve --ui-dir` sends the `.br`/`.gz` written at build time when the
   browser accepts them: no compression on the fly.

## Realtime

One `EventSource` on `GET /api/events`. The daemon sends no `id:` field, so `Last-Event-ID` is not
used: the stream remembers the last bus id and reconnects to `?since=<id>`, which replays the
daemon's `Bus::recent` ring (up to 100 events). Before each attempt it probes
`GET /api/gateway/status`; a changed `startedAt` (daemon restart) or a replay starting after a gap
refetches the whole cache, through the batcher. Backoff: 1 s, doubling, capped at 30 s.
