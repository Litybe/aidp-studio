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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-sm text-slate-200">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded border border-slate-800 bg-slate-900 p-5">
        <h1 className="text-lg font-semibold text-slate-100">Connexion</h1>
        <p className="text-slate-400">Cet accès demande le jeton de l&apos;interface (AIDP_UI_TOKEN).</p>
        <label className="flex flex-col gap-1">
          Jeton
          <input
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-11 rounded border border-slate-700 bg-slate-950 px-3 text-base text-slate-100"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Se souvenir sur cet appareil
        </label>
        <button type="submit" className="min-h-11 rounded bg-sky-600 px-4 font-semibold text-white hover:bg-sky-500">
          Se connecter
        </button>
      </form>
    </div>
  )
}
