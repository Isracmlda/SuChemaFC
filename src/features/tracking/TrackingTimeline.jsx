import { MdCheckCircle, MdErrorOutline, MdRadioButtonUnchecked, MdSchedule } from 'react-icons/md'
import { formatDateTime } from '../../utils/dates.js'
import { statusLabel } from '../orders/orderStatus.js'
import { buildStages, showsEstimate, sortHistory } from './tracking.js'

const ICON = {
  done: { Icon: MdCheckCircle, tone: 'text-success', text: 'completado' },
  current: { Icon: MdSchedule, tone: 'text-accent', text: 'en curso' },
  pending: { Icon: MdRadioButtonUnchecked, tone: 'text-muted', text: 'pendiente' },
}

/** Etapas del pedido y su historial. `tracking` viene de `normalizeTracking`. */
export default function TrackingTimeline({ tracking }) {
  const stages = buildStages(tracking.status)
  const history = sortHistory(tracking.timeline)

  return (
    <div className="flex flex-col gap-5">
      {tracking.status === 'cancelado' && (
        <p role="status" className="rounded-md border border-danger p-3 text-danger">
          <span aria-hidden="true">⚠ </span>
          Este pedido fue cancelado.
        </p>
      )}
      {tracking.status === 'pago_rechazado' && (
        <p role="status" className="rounded-md border border-danger p-3 text-danger">
          <span aria-hidden="true">⚠ </span>
          No pudimos confirmar tu pago. Escríbenos por WhatsApp con tu comprobante.
        </p>
      )}
      {showsEstimate(tracking) && (
        <p className="rounded-md border border-border bg-surface p-3 text-sm">
          <strong>Fecha estimada:</strong> {formatDateTime(tracking.estimatedDate)}. Puede cambiar
          si el proveedor se atrasa; te avisaremos.
        </p>
      )}

      {stages.length > 0 && (
        <ol aria-label="Etapas del pedido" className="flex flex-col gap-3">
          {stages.map((s) => {
            const { Icon, tone, text } = s.problem
              ? { Icon: MdErrorOutline, tone: 'text-danger', text: 'con problema' }
              : ICON[s.state]
            return (
              <li
                key={s.status}
                aria-current={s.state === 'current' ? 'step' : undefined}
                className="flex items-center gap-3"
              >
                <Icon className={`size-6 shrink-0 ${tone}`} aria-hidden="true" />
                <span className={s.state === 'pending' ? 'text-muted' : 'font-semibold'}>
                  {s.label}
                  <span className="sr-only"> ({text})</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 font-bold">Historial</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((e, i) => (
              <li key={i} className="border-s-2 border-border-strong ps-3">
                <span className="font-semibold">{statusLabel(e.status)}</span>
                {e.at != null && <span className="text-muted"> · {formatDateTime(e.at)}</span>}
                {e.note && <span className="block text-muted">{e.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
