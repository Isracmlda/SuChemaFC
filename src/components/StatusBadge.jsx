import { statusLabel } from '../features/orders/orderStatus.js'

/** Etiqueta con el estado de un pedido (la información no depende solo del color). */
export default function StatusBadge({ status }) {
  const tone =
    status === 'cancelado' || status === 'pago_rechazado'
      ? 'border-danger text-danger'
      : status === 'pago_pendiente_revision'
        ? 'border-accent text-accent'
        : 'border-success text-success'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${tone}`}>
      {statusLabel(status)}
    </span>
  )
}
