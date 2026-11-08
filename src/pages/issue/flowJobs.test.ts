import type { FlowRun } from '../../api/types'
import { buildJobs, defaultJob, isHumanStep } from './flowJobs'

const flow: FlowRun = {
  key: 'GH-7',
  def: {
    id: 'dev',
    version: 1,
    steps: [
      { id: 'plan', phase: 'plan' },
      { id: 'loop', phase: 'build', kind: 'loop', body: [{ id: 'code', phase: 'build' }, { id: 'check', phase: 'build' }] },
      { id: 'ok', phase: 'merge', kind: 'human' },
    ],
  },
  status: 'failed',
  current: 'check',
  steps: {
    plan: { status: 'done' },
    loop: { status: 'running', iteration: 2 },
    code: { status: 'done' },
    check: { status: 'failed', detail: 'boom' },
  },
}

describe('buildJobs', () => {
  it('makes one job per phase with a status, and flags loop members', () => {
    const jobs = buildJobs(flow)
    expect(jobs.map((job) => [job.phase, job.status])).toEqual([
      ['plan', 'success'],
      ['build', 'failure'],
      ['merge', 'pending'],
    ])
    const build = jobs[1]
    expect(build?.steps.map((step) => [step.id, step.parent, step.children])).toEqual([
      ['loop', null, 2],
      ['code', 'loop', 0],
      ['check', 'loop', 0],
    ])
    expect(build?.finished).toBe(1)
  })

  it('stops the clock of a job nothing runs in at its last finished step', () => {
    const stopped: FlowRun = {
      ...flow,
      def: { id: 'dev', version: 1, steps: [{ id: 'a', phase: 'merge' }, { id: 'b', phase: 'merge' }, { id: 'c', phase: 'merge' }] },
      current: null,
      steps: {
        a: { status: 'done', started_at: '2026-11-08T10:00:00Z', finished_at: '2026-11-08T10:01:00Z' },
        b: { status: 'failed', started_at: '2026-11-08T10:01:00Z', finished_at: '2026-11-08T10:02:00Z' },
      },
    }
    expect(buildJobs(stopped)[0]?.endedAt).toBe('2026-11-08T10:02:00Z')
  })

  it('files a step without a phase under its previous step, and a loop under its members', () => {
    const mixed: FlowRun = {
      ...flow,
      def: {
        id: 'dev',
        version: 1,
        steps: [
          { id: 'setup', phase: 'prepare' },
          { id: 'loop', kind: 'loop', body: [{ id: 'test', phase: 'test' }] },
          { id: 'label' },
          { id: 'merge', phase: 'merge' },
        ],
      },
      current: null,
      steps: {},
    }
    expect(buildJobs(mixed).map((job) => [job.phase, job.steps.map((step) => step.id)])).toEqual([
      ['prepare', ['setup']],
      ['test', ['loop', 'test', 'label']],
      ['merge', ['merge']],
    ])
  })

  it('opens the job holding the current step first', () => {
    expect(defaultJob(buildJobs(flow))).toBe('build')
    expect(defaultJob([])).toBeNull()
  })

  it('knows a human step by its kind or its wait', () => {
    const steps = buildJobs(flow).flatMap((job) => job.steps)
    expect(steps.filter(isHumanStep).map((step) => step.id)).toEqual(['ok'])
  })
})
