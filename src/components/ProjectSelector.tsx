import { useState } from 'react'
import { useProjects } from '../api/queries'
import { Icon } from './ui/Icon'

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
export function ProjectSelector({ className = '' }: { className?: string }) {
  const projects = useProjects()
  const [selected, setSelected] = useState<string | null>(readStored)
  const list = projects.data ?? []
  if (list.length === 0) {
    return (
      <span className={`flex items-center gap-1.5 text-ink-faint ${className}`}>
        <Icon name="github" size={14} />
        {projects.isPending ? '…' : 'aucun projet'}
      </span>
    )
  }
  const current = list.find((project) => project.id === selected) ?? list[0]
  return (
    <label className={`relative flex items-center ${className}`}>
      <Icon name="github" size={14} className="pointer-events-none absolute left-2 text-ink-faint" />
      <select
        aria-label="Projet"
        className="w-full cursor-pointer rounded-md border border-line bg-canvas py-1 pl-7 pr-7 text-xs font-medium text-ink hover:border-line-strong"
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
    </label>
  )
}
