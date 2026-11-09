import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useProjects } from '../../api/queries'
import { apiSend } from '../../api/send'
import type { CatalogTemplate, TemplateInput } from '../../api/types/settings'
import { showToast } from '../../lib/toast'
import { useCatalogTemplates } from '../../pages/settings/queries'
import { Buttons, Field, INPUT, StartError } from './fields'
import { Modal } from './Modal'
import type { StartReply } from './TicketRunDialog'

const PROJECT_KEY = 'aidp-studio.project'

function storedProject(): string {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** The declared inputs of a template as a list, whether the daemon sends a list or a map. */
export function inputsOf(template: CatalogTemplate | undefined): TemplateInput[] {
  const inputs = template?.inputs
  if (!inputs) return []
  if (Array.isArray(inputs)) return inputs
  return Object.entries(inputs).map(([name, def]) => ({ ...def, name }))
}

/** Values to send: empty fields leave, numbers become numbers. */
export function buildInputs(inputs: TemplateInput[], values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const input of inputs) {
    const value = values[input.name]
    if (value === undefined || value === '') continue
    out[input.name] = input.type === 'number' && typeof value === 'string' ? Number(value) : value
  }
  return out
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: TemplateInput
  value: unknown
  onChange: (value: unknown) => void
}) {
  const label = input.label ?? input.name
  const required = input.required === true
  if (input.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {label}
        {required ? <span className="text-amber-400"> *</span> : null}
      </label>
    )
  }
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  let control
  if (input.options && input.options.length > 0) {
    control = (
      <select className={INPUT} value={text} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {input.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  } else if (input.type === 'text') {
    control = <textarea className={INPUT} rows={3} value={text} onChange={(event) => onChange(event.target.value)} />
  } else {
    control = (
      <input
        className={INPUT}
        type={input.type === 'number' ? 'number' : 'text'}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  return (
    <Field label={label} required={required}>
      {control}
      {input.description ? <span className="block text-ink-faint">{input.description}</span> : null}
    </Field>
  )
}

function Form({ templates, onClose }: { templates: CatalogTemplate[]; onClose: () => void }) {
  const navigate = useNavigate()
  const projects = useProjects().data ?? []
  const [templateId, setTemplateId] = useState('')
  const [projectChoice, setProjectChoice] = useState<string | null>(null)
  const [track, setTrack] = useState<'standard' | 'bug'>('standard')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const selected = templates.find((entry) => entry.id === templateId) ?? templates[0]
  const inputs = inputsOf(selected)
  const stored = storedProject()
  const project = projectChoice ?? (projects.some((p) => p.id === stored) ? stored : (projects[0]?.id ?? ''))
  const current = (input: TemplateInput): unknown => (input.name in values ? values[input.name] : input.default)

  const start = useMutation({
    retry: false,
    mutationFn: (body: Record<string, unknown>) => apiSend<StartReply | undefined>('POST', '/runs/start', body),
    onSuccess: (reply) => {
      showToast(`Run lancé${reply?.runId ? ` (${reply.runId})` : ''}`)
      onClose()
      if (reply?.flowKey) void navigate({ to: '/issue/$key', params: { key: reply.flowKey } })
    },
  })
  const body = buildInputs(
    inputs,
    Object.fromEntries(inputs.map((input) => [input.name, current(input)])),
  )
  const missing = inputs.some(
    (input) => input.required === true && input.type !== 'boolean' && body[input.name] === undefined,
  )

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected || missing) return
        const payload: Record<string, unknown> = { template: selected.id, inputs: body, track }
        if (project !== '') payload['project'] = project
        start.mutate(payload)
      }}
    >
      <Field label="Pipeline" required>
        <select
          className={INPUT}
          value={selected?.id ?? ''}
          onChange={(event) => {
            setTemplateId(event.target.value)
            setValues({})
          }}
        >
          {templates.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name ?? entry.id}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Projet">
        <select className={INPUT} value={project} onChange={(event) => setProjectChoice(event.target.value)}>
          <option value="">— par défaut —</option>
          {projects.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Track">
        <select className={INPUT} value={track} onChange={(event) => setTrack(event.target.value as 'standard' | 'bug')}>
          <option value="standard">standard</option>
          <option value="bug">bug</option>
        </select>
      </Field>
      {inputs.map((input) => (
        <InputField
          key={`${selected?.id ?? ''}:${input.name}`}
          input={input}
          value={current(input)}
          onChange={(value) => setValues((previous) => ({ ...previous, [input.name]: value }))}
        />
      ))}
      <StartError error={start.error} />
      <Buttons pending={start.isPending} disabled={!selected || missing} submitLabel="Lancer" onCancel={onClose} />
    </form>
  )
}

/** « Nouveau run » from the top bar: a pipeline, a project and the inputs it declares. */
export default function GlobalRunDialog({ onClose }: { onClose: () => void }) {
  const templates = useCatalogTemplates()
  return (
    <Modal title="Nouveau run" onClose={onClose}>
      {templates.isPending ? <p className="text-xs text-ink-faint">Chargement…</p> : null}
      {templates.isError ? (
        <p className="text-xs text-ink-faint" data-testid="soon">
          Lancement manuel : bientôt disponible
        </p>
      ) : null}
      {templates.data ? <Form templates={templates.data} onClose={onClose} /> : null}
    </Modal>
  )
}
