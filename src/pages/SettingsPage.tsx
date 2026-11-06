import { Placeholder } from '../components/Placeholder'
import { useGatewayStatus } from '../api/queries'
import type { GatewayStatus } from '../api/types'

const selectDaemon = (status: GatewayStatus) => ({
  vault: status.vault,
  stateDir: status.stateDir,
  skillRoot: status.skillRoot,
  startedAt: status.startedAt,
})

export default function SettingsPage() {
  const daemon = useGatewayStatus(selectDaemon).data
  return (
    <Placeholder title="Réglages" lot="F2 : routage labels → flow, politique de modèles, slots, seuils de budget.">
      {daemon ? (
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 break-all">
          <dt className="text-slate-400">Vault</dt>
          <dd>{daemon.vault ?? 'désactivé'}</dd>
          <dt className="text-slate-400">État du daemon</dt>
          <dd>{daemon.stateDir}</dd>
          <dt className="text-slate-400">Skill</dt>
          <dd>{daemon.skillRoot ?? '—'}</dd>
          <dt className="text-slate-400">Démarré</dt>
          <dd>{daemon.startedAt}</dd>
        </dl>
      ) : null}
    </Placeholder>
  )
}
