import { useState } from 'react'
import { useProjects } from '../api/queries'

const STORAGE_KEY = 'aidp-studio.project'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(projectId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, projectId)
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
}

/** The registered repositories (`GET /api/projects`); a plain label when there is none. */
export function ProjectSelector() {
  const projects = useProjects()
  const [selected, setSelected] = useState<string | null>(readStored)
  const list = projects.data ?? []
  if (list.length === 0) {
    return <span className="text-slate-400">{projects.isPending ? '…' : 'aucun projet'}</span>
  }
  const current = list.find((project) => project.id === selected) ?? list[0]
  return (
    <select
      aria-label="Projet"
      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-200"
      value={current?.id ?? ''}
      onChange={(event) => {
        setSelected(event.target.value)
        writeStored(event.target.value)
      }}
    >
      {list.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  )
}
