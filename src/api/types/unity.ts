// C1 (compile gate result) and C3 (`GET /api/unity/status`) of gamedev-contracts.md.

export interface CompileError {
  file: string
  line: number
  column?: number
  message: string
}

/** `<projet>/.aidp/compile/results/<id>.json`, the most recent as `lastCompile`. */
export interface CompileResult {
  id: string
  ok: boolean
  errors: CompileError[]
  warnings: number
  durationMs: number
  unityVersion?: string
  finishedAt: string
}

export interface LockHolder {
  flowKey: string
  /** `GH-214`. */
  ticketKey: string
  stepId: string
  since: string
}

export interface UnityStatus {
  editor: { running: boolean; pid: number | null; projectPath: string | null }
  lock: { held: boolean; holder: LockHolder | null }
  lastCompile: CompileResult | null
  lastPlaytest: { id: string; passed: boolean; finishedAt: string } | null
}
