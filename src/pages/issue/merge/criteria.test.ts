import {
  buildRows,
  countStatuses,
  foldResults,
  isResultFile,
  normalizeId,
  normalizeStatus,
  parseCriteria,
  parseJsonText,
  resultsFromCriteria,
  resultsFromPlaytest,
  type CriterionResult,
} from './criteria'
import { initialOpen, isBinaryPath, isImagePath, parseDiff } from './diff'
import { zoomFor } from './FinalResult'

const BODY = `# GH-279 - feat(art): cadre

## Description technique
- [ ] **FAUX-1** — dans une autre section

## Critères d'acceptation

- [ ] **CA-1** — Étant donné \`pause_frame.aseprite\`, alors le canevas fait **24x24**.
- [x] **CA-2**: la liste est vide.
- [ ] **CA-3** - un tiret simple
* [ ] CA-04 sans gras
- [ ] **CA-1** — doublon ignoré

## Scénarios de test
- [ ] **CA-9** — hors section
`

describe('parseCriteria', () => {
  it('reads the labels of the acceptance section only, in order, without markdown noise', () => {
    expect(parseCriteria(BODY)).toEqual([
      { id: 'CA-1', label: 'Étant donné pause_frame.aseprite, alors le canevas fait 24x24.' },
      { id: 'CA-2', label: 'la liste est vide.' },
      { id: 'CA-3', label: 'un tiret simple' },
      { id: 'CA-4', label: 'sans gras' },
    ])
  })

  it('falls back to the whole body when there is no such section', () => {
    expect(parseCriteria('- [ ] **CA-1** — seul')).toEqual([{ id: 'CA-1', label: 'seul' }])
    expect(parseCriteria('rien ici')).toEqual([])
  })

  it('normalizes ids', () => {
    expect(normalizeId('ca1')).toBe('CA-1')
    expect(normalizeId(' CA 01 ')).toBe('CA-1')
    expect(normalizeId('IMP-3')).toBe('IMP-3')
  })
})

describe('normalizeStatus', () => {
  it('maps every word the stages write', () => {
    for (const word of ['ok', 'pass', 'proven', 'proved', '✅']) expect(normalizeStatus(word)).toBe('pass')
    for (const word of ['fail', 'failed', 'missing', '❌']) expect(normalizeStatus(word)).toBe('fail')
    for (const word of ['deferred', 'play_mode', '🧪']) expect(normalizeStatus(word)).toBe('deferred')
  })

  it('never turns an odd or missing word into a pass', () => {
    for (const word of ['partial', '⚠️', 'not_verifiable', 'skipped', '', 'peut-être']) expect(normalizeStatus(word)).toBe('unverified')
    expect(normalizeStatus(undefined)).toBe('unverified')
    expect(normalizeStatus(1)).toBe('unverified')
  })
})

describe('results', () => {
  it('reads criteria of a findings.json, BOM included', () => {
    const json = parseJsonText('\uFEFF{"criteria":[{"id":"CA-1","status":"ok","proof":"24x24"},{"id":"CA-6","status":"deferred","proof":"Unity"},{"status":"ok"}]}')
    const results = resultsFromCriteria(json, 'review · review/findings.json')
    expect(results.map((r) => [r.id, r.status, r.proof])).toEqual([
      ['CA-1', 'pass', '24x24'],
      ['CA-6', 'deferred', 'Unity'],
    ])
    expect(results[0]?.source).toBe('review · review/findings.json')
  })

  it('folds the scenarios of a playtest per criterion: one failure fails it, skipped leaves it unverified', () => {
    const json = {
      scenarios: [
        { id: 'issue-12-ca1', criterion: 'CA-1', result: 'pass', asserts: ['hp = 10'] },
        { id: 'issue-12-ca1b', criterion: 'CA-1', result: 'fail', asserts: ['hp = 9'] },
        { id: 'issue-12-ca2', criterion: 'CA-2', result: 'pass' },
        { id: 'issue-12-ca3', criterion: 'CA-3', result: 'skipped' },
        { id: 'issue-12-ca4', result: 'pass' },
      ],
    }
    const byId = new Map(resultsFromPlaytest(json, 'test').map((r) => [r.id, r]))
    expect(byId.get('CA-1')?.status).toBe('fail')
    expect(byId.get('CA-1')?.proof).toBe('hp = 10 ; hp = 9')
    expect(byId.get('CA-2')?.status).toBe('pass')
    expect(byId.get('CA-3')?.status).toBe('unverified')
    expect(byId.get('CA-4')?.status).toBe('pass')
  })

  it('ignores files that are not result files', () => {
    expect(resultsFromCriteria({ nothing: 1 }, 's')).toEqual([])
    expect(resultsFromPlaytest(null, 's')).toEqual([])
    expect(isResultFile('review/findings.json')).toBe(true)
    expect(isResultFile('test/playtest.json')).toBe(true)
    expect(isResultFile('prepare/context.json')).toBe(false)
  })
})

const result = (id: string, status: CriterionResult['status'], extra: Partial<CriterionResult> = {}): CriterionResult => ({
  id,
  status,
  proof: `${id} ${status}`,
  raw: status,
  source: 's',
  ...extra,
})

describe('matching criteria and results', () => {
  const criteria = [
    { id: 'CA-1', label: 'un' },
    { id: 'CA-2', label: 'deux' },
    { id: 'CA-3', label: 'trois' },
  ]

  it('the latest answer wins, but a later "unverified" does not erase a real one', () => {
    const folded = foldResults([
      result('CA-1', 'fail'),
      result('CA-1', 'pass'),
      result('CA-2', 'pass'),
      result('CA-2', 'unverified'),
      result('CA-3', 'deferred'),
      result('CA-3', 'pass'),
    ])
    expect(folded.get('CA-1')?.status).toBe('pass')
    expect(folded.get('CA-2')?.status).toBe('pass')
    expect(folded.get('CA-3')?.status).toBe('pass')
  })

  it('a criterion with no result is "non vérifié", never passed; stage-only ids come last', () => {
    const rows = buildRows(criteria, foldResults([result('CA-1', 'pass'), result('IMP-2', 'pass'), result('IMP-1', 'fail', { label: 'import' })]))
    expect(rows.map((r) => [r.id, r.status, r.listed])).toEqual([
      ['CA-1', 'pass', true],
      ['CA-2', 'unverified', true],
      ['CA-3', 'unverified', true],
      ['IMP-1', 'fail', false],
      ['IMP-2', 'pass', false],
    ])
    expect(rows[1]?.proof).toBe('')
    expect(countStatuses(rows)).toEqual({ pass: 2, fail: 1, deferred: 0, unverified: 2 })
  })
})

describe('diff helpers', () => {
  it('cuts a patch into typed lines', () => {
    const lines = parseDiff('@@ -1,2 +1,2 @@\n a\n-b\n+c\n\\ No newline at end of file\n')
    expect(lines.map((l) => l.kind)).toEqual(['hunk', 'ctx', 'del', 'add', 'note'])
  })

  it('opens small files while the budget lasts and folds the big ones', () => {
    const size = (additions: number) => ({ additions, deletions: 0 })
    expect(initialOpen([size(10), size(500), size(81), size(70), size(70), size(70), size(70), size(70)])).toEqual([
      true, false, false, true, true, true, true, false,
    ])
  })

  it('tells images and binaries from text', () => {
    expect(isImagePath('Assets/a/pause_frame.PNG')).toBe(true)
    expect(isImagePath('a.aseprite')).toBe(false)
    expect(isBinaryPath('a.aseprite')).toBe(true)
    expect(isBinaryPath('Assets/Foo.cs')).toBe(false)
  })

  it('zooms by whole numbers to fit the box', () => {
    expect(zoomFor(24, 24)).toBe(15)
    expect(zoomFor(32, 32, { width: 300, height: 360 })).toBe(9)
    expect(zoomFor(2000, 1000)).toBe(1)
    expect(zoomFor(0, 0)).toBe(1)
  })
})
