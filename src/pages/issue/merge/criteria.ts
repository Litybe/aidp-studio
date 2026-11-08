// Acceptance criteria of a ticket and their results.
// Labels come from the issue body (`- [ ] **CA-1** — ...`). Results come from what the review and
// test stages write in their run folders: `criteria` of `findings.json` / `review.json`
// (`id`, `status`, `proof`) and `scenarios` of `playtest.json` (`criterion`, `result`).
// A criterion without any result stays "unverified": it is never shown as passed.

export type CriterionStatus = 'pass' | 'fail' | 'deferred' | 'unverified'

export interface Criterion {
  id: string
  label: string
}

export interface CriterionResult {
  id: string
  status: CriterionStatus
  proof: string
  /** The status as the stage wrote it, kept to explain an "unverified" that came from an odd word. */
  raw: string
  /** Where it was read, e.g. `review · review/findings.json`. */
  source: string
  /** Label carried by the result itself (fallback for ids the issue does not list). */
  label?: string
}

export interface CriterionRow {
  id: string
  label: string
  status: CriterionStatus
  proof: string
  raw: string
  source: string
  /** False for a criterion only the stages mention (e.g. `IMP-1`). */
  listed: boolean
}

export const STATUS_LABEL: Record<CriterionStatus, string> = {
  pass: 'réussi',
  fail: 'échoué',
  deferred: 'reporté au test Unity',
  unverified: 'non vérifié',
}

/** `ca1`, `CA 1`, ` CA-01 ` become `CA-1`; anything that is not a letters+number id is returned trimmed. */
export function normalizeId(raw: string): string {
  const text = raw.trim()
  const match = /^([A-Za-z]+)[\s-]?0*(\d+)$/.exec(text)
  return match ? `${(match[1] ?? '').toUpperCase()}-${match[2] ?? ''}` : text
}

const SECTION_HEADING = /^#{1,6}\s*crit[èe]res?\s+d['’]acceptation/i
const ANY_HEADING = /^#{1,6}\s/
const ITEM = /^\s*[-*+]\s*\[[ xX]\]\s*\*{0,2}([A-Za-z]{1,6}[\s-]?\d+)\*{0,2}\s*(?:[—–:-]+\s*)?(.*)$/

function plain(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()
}

/** The criteria listed in the issue body, in order. Only the « Critères d'acceptation » section when there is one. */
export function parseCriteria(body: string): Criterion[] {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((line) => SECTION_HEADING.test(line))
  let scope = lines
  if (start >= 0) {
    const rest = lines.slice(start + 1)
    const end = rest.findIndex((line) => ANY_HEADING.test(line))
    scope = end >= 0 ? rest.slice(0, end) : rest
  }
  const seen = new Set<string>()
  const out: Criterion[] = []
  for (const line of scope) {
    const match = ITEM.exec(line)
    if (!match) continue
    const id = normalizeId(match[1] ?? '')
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label: plain(match[2] ?? '') })
  }
  return out
}

const PASS = new Set(['ok', 'pass', 'passed', 'proven', 'proved', 'success', 'succeeded', 'met', 'verified', 'done', '✅', '✔', '✓'])
const FAIL = new Set(['fail', 'failed', 'ko', 'error', 'missing', 'not_met', 'unmet', '❌', '✖', '✗'])
const DEFERRED = new Set(['deferred', 'defer', 'reported', 'play_mode', 'playmode', 'unity', 'unity-test', 'manual', '🧪'])

/** Maps the many words the stages use onto the four states. Anything unknown is "unverified". */
export function normalizeStatus(raw: unknown): CriterionStatus {
  if (typeof raw !== 'string') return 'unverified'
  const word = raw.replace(/️/g, '').trim().toLowerCase()
  if (PASS.has(word)) return 'pass'
  if (FAIL.has(word)) return 'fail'
  if (DEFERRED.has(word)) return 'deferred'
  return 'unverified'
}

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' ; ')
  return ''
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Parses a JSON file as a stage writes it (Windows tools prepend a BOM). Null when unreadable. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '')) as unknown
  } catch {
    return null
  }
}

/** Results of a `findings.json` / `review.json`: its `criteria` array of `{ id, status, proof }`. */
export function resultsFromCriteria(json: unknown, source: string): CriterionResult[] {
  if (!isRecord(json) || !Array.isArray(json['criteria'])) return []
  const out: CriterionResult[] = []
  for (const entry of json['criteria'] as unknown[]) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string') continue
    const raw = typeof entry['status'] === 'string' ? entry['status'] : ''
    const label = asText(entry['criterion']) || asText(entry['label']) || asText(entry['text'])
    out.push({
      id: normalizeId(entry['id']),
      status: normalizeStatus(raw),
      proof: asText(entry['proof']),
      raw,
      source,
      ...(label ? { label } : {}),
    })
  }
  return out
}

const SCENARIO_ID = /\bca[-_ ]?(\d+)\b/i

function scenarioCriteria(scenario: Record<string, unknown>): string[] {
  const named = scenario['criterion'] ?? scenario['criteria']
  const list = Array.isArray(named) ? named : [named]
  const ids = list.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(normalizeId)
  if (ids.length > 0) return ids
  const fromId = typeof scenario['id'] === 'string' ? SCENARIO_ID.exec(scenario['id']) : null
  return fromId ? [`CA-${fromId[1] ?? ''}`] : []
}

/**
 * Results of a `playtest.json`: one per criterion, folded from its scenarios. Any failed scenario
 * fails the criterion; it passes only when every scenario passed; skipped ones leave it unverified.
 */
export function resultsFromPlaytest(json: unknown, source: string): CriterionResult[] {
  if (!isRecord(json) || !Array.isArray(json['scenarios'])) return []
  const byId = new Map<string, { statuses: CriterionStatus[]; raws: string[]; proofs: string[] }>()
  for (const entry of json['scenarios'] as unknown[]) {
    if (!isRecord(entry)) continue
    const raw = typeof entry['result'] === 'string' ? entry['result'] : typeof entry['status'] === 'string' ? entry['status'] : ''
    const proof = asText(entry['asserts']) || asText(entry['observed']) || asText(entry['title'])
    for (const id of scenarioCriteria(entry)) {
      const slot = byId.get(id) ?? { statuses: [], raws: [], proofs: [] }
      slot.statuses.push(normalizeStatus(raw))
      slot.raws.push(raw)
      if (proof) slot.proofs.push(proof)
      byId.set(id, slot)
    }
  }
  const out: CriterionResult[] = []
  for (const [id, slot] of byId) {
    const status: CriterionStatus = slot.statuses.includes('fail')
      ? 'fail'
      : slot.statuses.every((value) => value === 'pass')
        ? 'pass'
        : 'unverified'
    out.push({ id, status, proof: slot.proofs.join(' ; '), raw: [...new Set(slot.raws)].join(', '), source })
  }
  return out
}

/** Reads the results a JSON file holds, whichever stage wrote it. */
export function resultsFromJson(json: unknown, source: string): CriterionResult[] {
  return [...resultsFromCriteria(json, source), ...resultsFromPlaytest(json, source)]
}

/** The files of a run that can carry criterion results. */
export function isResultFile(path: string): boolean {
  return /(^|\/)(findings|review|playtest)\.json$/.test(path)
}

/**
 * Folds the results of every source, oldest first: the latest word wins, except that a later
 * "unverified" never erases an earlier real answer.
 */
export function foldResults(ordered: readonly CriterionResult[]): Map<string, CriterionResult> {
  const out = new Map<string, CriterionResult>()
  for (const result of ordered) {
    const previous = out.get(result.id)
    if (previous && previous.status !== 'unverified' && result.status === 'unverified') continue
    out.set(result.id, previous?.label && !result.label ? { ...result, label: previous.label } : result)
  }
  return out
}

const numberOf = (id: string): number => Number(/(\d+)$/.exec(id)?.[1] ?? Number.MAX_SAFE_INTEGER)

/** One row per listed criterion (issue order), then the extra ids only the stages mention. */
export function buildRows(criteria: readonly Criterion[], results: ReadonlyMap<string, CriterionResult>): CriterionRow[] {
  const rows: CriterionRow[] = criteria.map((criterion) => {
    const result = results.get(criterion.id)
    return {
      id: criterion.id,
      label: criterion.label,
      status: result?.status ?? 'unverified',
      proof: result?.proof ?? '',
      raw: result?.raw ?? '',
      source: result?.source ?? '',
      listed: true,
    }
  })
  const listed = new Set(criteria.map((criterion) => criterion.id))
  const extras = [...results.values()]
    .filter((result) => !listed.has(result.id))
    .sort((a, b) => a.id.replace(/\d+$/, '').localeCompare(b.id.replace(/\d+$/, '')) || numberOf(a.id) - numberOf(b.id))
  for (const result of extras) {
    rows.push({
      id: result.id,
      label: result.label ?? '',
      status: result.status,
      proof: result.proof,
      raw: result.raw,
      source: result.source,
      listed: false,
    })
  }
  return rows
}

export function countStatuses(rows: readonly CriterionRow[]): Record<CriterionStatus, number> {
  const counts: Record<CriterionStatus, number> = { pass: 0, fail: 0, deferred: 0, unverified: 0 }
  for (const row of rows) counts[row.status] += 1
  return counts
}
