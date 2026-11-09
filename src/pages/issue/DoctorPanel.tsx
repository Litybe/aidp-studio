import { useFlowDoctor } from '../../api/f1queries'
import type { DoctorIncident, DoctorStatus, DoctorTrigger } from '../../api/types'
import type { Tone } from '../../components/ui/classes'
import { Pill } from '../../components/ui/Pill'
import { formatDateTime } from '../../lib/format'

export const DOCTOR_STATUS: Record<DoctorStatus, { label: string; tone: Tone }> = {
  detected: { label: 'détecté', tone: 'warn' },
  investigating: { label: 'en investigation', tone: 'accent' },
  fixed: { label: 'corrigé', tone: 'ok' },
  action_failed: { label: 'action en échec', tone: 'danger' },
  needs_human: { label: 'intervention humaine', tone: 'warn' },
  refused: { label: 'action refusée', tone: 'danger' },
  no_action: { label: 'sans action', tone: 'muted' },
  investigation_failed: { label: 'investigation en échec', tone: 'danger' },
  capped: { label: 'plafond atteint', tone: 'warn' },
}

export const DOCTOR_TRIGGER: Record<DoctorTrigger, string> = {
  flow_failed: 'flow en échec',
  flow_escalated: 'flow escaladé',
  run_paused: 'run en pause',
  step_stuck: 'étape bloquée',
  waiting_too_long: 'attente externe trop longue',
}

function Incident({ incident }: { incident: DoctorIncident }) {
  const status = DOCTOR_STATUS[incident.status] ?? { label: incident.status, tone: 'muted' as Tone }
  const diagnosis = incident.diagnosis
  return (
    <li className="space-y-1.5 border-t border-line px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <Pill tone={status.tone} dot>
          {status.label}
        </Pill>
        <span>{DOCTOR_TRIGGER[incident.trigger] ?? incident.trigger}</span>
        {incident.step ? <span className="font-mono text-ink-soft">{incident.step}</span> : null}
        <span className="text-ink-faint">{formatDateTime(incident.detectedAt)}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-faint">Cause</dt>
        <dd className="min-w-0 text-ink">{diagnosis?.cause || incident.detail}</dd>
        {diagnosis ? (
          <>
            <dt className="text-ink-faint">Diagnostic</dt>
            <dd className="min-w-0 text-ink-muted">
              <span className="font-mono">{diagnosis.category}</span>
              {` · confiance ${Math.round(diagnosis.confidence * 100)} %`}
            </dd>
          </>
        ) : null}
        <dt className="text-ink-faint">Action</dt>
        <dd className="min-w-0 text-ink-muted">
          {incident.outcome ? (
            <>
              <span className="font-mono">{incident.outcome.action}</span>
              {` — ${incident.outcome.detail}`}
            </>
          ) : (
            (diagnosis?.action ?? '—')
          )}
        </dd>
        {incident.note ? (
          <>
            <dt className="text-ink-faint">Résultat</dt>
            <dd className="min-w-0 text-ink-muted">{incident.note}</dd>
          </>
        ) : null}
      </dl>
      {diagnosis?.proposed_patch ? (
        <details className="text-xs">
          <summary className="min-h-10 cursor-pointer py-2 text-ink-muted">Correctif du harness proposé (non appliqué)</summary>
          <pre className="overflow-x-auto rounded border border-line bg-canvas p-2 whitespace-pre">{diagnosis.proposed_patch}</pre>
        </details>
      ) : null}
    </li>
  )
}

/** The « Docteur » section: the incidents the daemon's doctor opened on this flow. Hidden when there are none. */
export function DoctorPanel({ flowKey }: { flowKey: string }) {
  const doctor = useFlowDoctor(flowKey)
  const incidents = doctor.data?.incidents ?? []
  if (incidents.length === 0) return null
  return (
    <section aria-label="Docteur" className="rounded-card border border-line bg-card">
      <h2 className="px-4 pt-3 pb-1 text-sm font-semibold text-ink">Docteur</h2>
      <ul>
        {incidents.map((incident) => (
          <Incident key={incident.id} incident={incident} />
        ))}
      </ul>
    </section>
  )
}
