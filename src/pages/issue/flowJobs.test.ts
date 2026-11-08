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

  it('opens the job holding the current step first', () => {
    expect(defaultJob(buildJobs(flow))).toBe('build')
    expect(defaultJob([])).toBeNull()
  })

  it('knows a human step by its kind or its wait', () => {
    const steps = buildJobs(flow).flatMap((job) => job.steps)
    expect(steps.filter(isHumanStep).map((step) => step.id)).toEqual(['ok'])
  })
})
