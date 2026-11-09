import { useState, type FormEvent } from 'react'
import { setToken } from '../api/auth'

/** Shown after a `401`: the daemon wants `AIDP_UI_TOKEN` (any access off the PC itself). */
export function LoginPage() {
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (value.trim() !== '') setToken(value, remember)
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-sm text-ink">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-line bg-card p-5">
        <h1 className="text-lg font-semibold text-ink">Connexion</h1>
        <p className="text-ink-muted">Cet accès demande le jeton de l&apos;interface (AIDP_UI_TOKEN).</p>
        <label className="flex flex-col gap-1">
          Jeton
          <input
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-11 rounded border border-line-strong bg-canvas px-3 text-base text-ink"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Se souvenir sur cet appareil
        </label>
        <button type="submit" className="min-h-11 rounded bg-accent-strong px-4 font-semibold text-white hover:bg-accent">
          Se connecter
        </button>
      </form>
    </div>
  )
}
