import { Timestamp, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { applyDelivery } from '../features/admin/delivery/delivery.js'
import { timelineEntry } from '../features/admin/orders/review.js'
import { orderRef } from '../features/checkout/checkout.js'
import { formatCRC } from '../utils/format.js'
import { commitWithAudit } from './audit.js'
import { docRef, getDocData } from './db.js'
import { findPaymentRef } from './adminOrders.js'

/** Lee un pedido por ID completo. Devuelve null si no existe. */
export const fetchOrder = (orderId) => getDocData('orders', orderId)

/**
 * Marca el pedido como entregado y, si había saldo, registra su cobro. Todo en UN lote con
 * bitácora: pedido, pago, número de comprobante (solo SINPE), rastreo público y auditoría.
 */
export async function deliverOrder(order, { method, reference }) {
  const result = applyDelivery(order, { method, reference }, Timestamp.now().toMillis())
  if (result.ref) {
    const used = await findPaymentRef(result.ref)
    if (used) {
      throw new Error(`Comprobante duplicado: ya se usó en el pedido ${orderRef(used.orderId)}.`)
    }
  }

  const note =
    result.collected > 0
      ? `Entregado. Saldo de ${formatCRC(result.collected)} cobrado (${method === 'sinpe' ? 'SINPE' : 'efectivo'}).`
      : 'Entregado.'
  const ops = [
    {
      type: 'update',
      ref: docRef('orders', order.id),
      data: {
        payments: result.payments,
        paidAmount: result.paidAmount,
        status: result.status,
      },
    },
    {
      type: 'update',
      ref: docRef('orderTracking', order.trackingCode),
      data: {
        status: result.status,
        timeline: arrayUnion(timelineEntry(result.status, Timestamp.now(), note)),
        estimatedDate: null,
        updatedAt: serverTimestamp(),
      },
    },
  ]
  if (result.ref) {
    ops.unshift({
      type: 'set',
      ref: docRef('paymentRefs', result.ref),
      data: { orderId: order.id, amount: result.collected, createdAt: serverTimestamp() },
    })
  }
  await commitWithAudit(ops, {
    action: 'editar',
    collection: 'orders',
    docId: order.id,
    summary: `${orderRef(order.id)} entregado. ${note}`.slice(0, 500),
  })
  return result
}
