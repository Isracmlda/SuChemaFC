import { formatAddress, orderRef } from '../../checkout/checkout.js'
import { describeCustom } from '../../personalization/personalization.js'
import { toMillis } from '../../../utils/dates.js'
import { balance, totalPaid } from '../orders/review.js'
import { buildQrPayload } from '../delivery/delivery.js'

/**
 * Datos del recibo, listos para dibujar. Un solo QR identifica el pedido completo. No depende del
 * navegador para poder probarse.
 */
export function buildReceiptModel(order) {
  const items = order.lines.map((line) => ({
    name: line.name,
    size: line.size,
    qty: line.qty,
    extras: [
      line.patches?.length ? `Parches: ${line.patches.map((p) => p.name).join(', ')}` : '',
      line.custom ? `Personalizada: ${describeCustom(line.custom)}` : '',
    ].filter(Boolean),
    lineTotal: line.unitPrice * line.qty,
  }))
  return {
    ref: orderRef(order.id),
    qrPayload: buildQrPayload(order.id),
    createdAt: toMillis(order.createdAt),
    customerName: order.customer?.name ?? '',
    phone: order.customer?.phone ?? '',
    // Solo en envíos por Correos va la dirección; en entregas coordinadas queda vacío.
    delivery: order.shippingMethod === 'correos' ? formatAddress(order.customer?.address) : '',
    items,
    totals: {
      subtotal: order.subtotal,
      discount: order.discount ?? 0,
      shipping: order.shipping ?? 0,
      total: order.total,
      paid: totalPaid(order),
      balance: balance(order),
    },
  }
}
