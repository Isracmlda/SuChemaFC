import {
  Timestamp,
  arrayUnion,
  deleteField,
  getDocs,
  limit,
  collection,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { applyPayment, normalizeReference, timelineEntry } from '../features/admin/orders/review.js'
import { commitWithAudit } from './audit.js'
import { cachedRead, docRef, getDocData } from './db.js'
import { deleteDriveFile } from './drive.js'
import { db } from './firebase.js'
import { orderRef } from '../features/checkout/checkout.js'
import { statusLabel } from '../features/orders/orderStatus.js'
import { formatCRC } from '../utils/format.js'

const ORDERS_LIMIT = 200
const cut = (text) => String(text).slice(0, 500)

/**
 * Los pedidos más recientes (el admin los lee todos; las reglas lo permiten solo a admins).
 * Pedidos, Proveedor y Entrega comparten una sola lectura durante 1 minuto; toda escritura de
 * admin vacía la caché (commitWithAudit).
 */
export function listOrders() {
  return cachedRead('orders', async () => {
    const snap = await getDocs(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ORDERS_LIMIT)),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }).then((rows) => [...rows])
}

export const loadOrderNotes = async (orderId) =>
  (await getDocData('orderPrivate', orderId))?.notes ?? ''

/** ¿Ese número de comprobante ya se usó? Devuelve { orderId, amount } o null. */
export async function findPaymentRef(reference) {
  const ref = normalizeReference(reference)
  if (!ref) return null
  return getDocData('paymentRefs', ref)
}

function trackingOps(order, status, note) {
  return {
    type: 'update',
    ref: docRef('orderTracking', order.trackingCode),
    data: {
      status,
      timeline: arrayUnion(timelineEntry(status, Timestamp.now(), note)),
      updatedAt: serverTimestamp(),
    },
  }
}

/**
 * "Comprobar": registra el número de comprobante (único), el pago, el estado y el historial
 * en UN lote con bitácora. No toca la imagen de Drive: se borra después con `deleteReceipt`.
 */
export async function confirmPayment(order, { reference, amount }) {
  const used = await findPaymentRef(reference)
  if (used) {
    throw new Error(
      used.orderId === order.id
        ? 'Ese comprobante ya se registró en este pedido.'
        : `Comprobante duplicado: ya se usó en el pedido ${orderRef(used.orderId)}.`,
    )
  }
  const result = applyPayment(order, { reference, amount }, Timestamp.now().toMillis())
  const note = `Pago de ${formatCRC(amount)} recibido`
  await commitWithAudit(
    [
      {
        type: 'set',
        ref: docRef('paymentRefs', result.ref),
        data: { orderId: order.id, amount, createdAt: serverTimestamp() },
      },
      {
        type: 'update',
        ref: docRef('orders', order.id),
        data: {
          payments: result.payments,
          paidAmount: result.paidAmount,
          status: result.status,
        },
      },
      trackingOps(order, result.status, result.statusChanged ? note : `${note} (pago parcial)`),
    ],
    {
      action: 'editar',
      collection: 'orders',
      docId: order.id,
      summary: cut(
        `Pago ${result.ref} de ${formatCRC(amount)}; estado: ${statusLabel(result.status)}`,
      ),
    },
  )
  return result
}

/** Borra la foto del comprobante en Drive y, solo si se pudo, quita su ID del pedido. */
export async function deleteReceipt(order) {
  if (!order.receiptFileId) return
  await deleteDriveFile(order.receiptFileId)
  await commitWithAudit(
    [{ type: 'update', ref: docRef('orders', order.id), data: { receiptFileId: deleteField() } }],
    {
      action: 'editar',
      collection: 'orders',
      docId: order.id,
      summary: 'Comprobante borrado de Drive',
    },
  )
}

async function changeStatus(order, status, { note, action, deleted }) {
  await commitWithAudit(
    [
      {
        type: 'update',
        ref: docRef('orders', order.id),
        data: { status, ...(deleted ? { deleted: true } : {}) },
      },
      trackingOps(order, status, note),
    ],
    {
      action,
      collection: 'orders',
      docId: order.id,
      summary: cut(`${orderRef(order.id)} → ${statusLabel(status)}${note ? `: ${note}` : ''}`),
    },
  )
}

/** Rechaza el pago con un motivo que el cliente ve en su rastreo. */
export const rejectPayment = (order, reason) =>
  changeStatus(order, 'pago_rechazado', { note: reason.trim(), action: 'editar' })

/** Cancela el pedido (borrado lógico: se conserva para la bitácora y las cuentas). */
export const cancelOrder = (order, reason = '') =>
  changeStatus(order, 'cancelado', { note: reason.trim(), action: 'eliminar', deleted: true })

/** Trabajos de impresión (recibos para PuraPrint) que se guardaron de este pedido. */
async function printJobDeletes(orderId) {
  const snap = await getDocs(query(collection(db, 'printJobs'), where('orderId', '==', orderId)))
  return snap.docs.map((d) => ({ type: 'delete', ref: d.ref }))
}

/**
 * Elimina el pedido para siempre: pedido, rastreo público, notas internas, recibos guardados para
 * imprimir y los números de comprobante que registró (quedan libres). La foto de Drive se manda a
 * la papelera; si Drive falla, el pedido se elimina igual y se avisa con `driveFailed`.
 */
export async function deleteOrder(order) {
  let driveFailed = false
  if (order.receiptFileId) {
    try {
      await deleteDriveFile(order.receiptFileId)
    } catch {
      driveFailed = true
    }
  }
  const refs = [...new Set((order.payments ?? []).map((p) => p.ref).filter(Boolean))]
  const jobs = await printJobDeletes(order.id)
  await commitWithAudit(
    [
      { type: 'delete', ref: docRef('orders', order.id) },
      { type: 'delete', ref: docRef('orderTracking', order.trackingCode) },
      { type: 'delete', ref: docRef('orderPrivate', order.id) },
      ...jobs,
      ...refs.map((ref) => ({ type: 'delete', ref: docRef('paymentRefs', ref) })),
    ],
    {
      action: 'eliminar',
      collection: 'orders',
      docId: order.id,
      summary: cut(`${orderRef(order.id)} (${order.customer?.name ?? ''}) eliminado para siempre`),
    },
  )
  return { driveFailed }
}

/** Notas internas: documento aparte, que el cliente nunca lee. */
export function saveOrderNotes(order, notes) {
  return commitWithAudit(
    [
      {
        type: 'set',
        ref: docRef('orderPrivate', order.id),
        data: { notes: notes.trim().slice(0, 2000), updatedAt: serverTimestamp() },
        merge: true,
      },
    ],
    {
      action: 'editar',
      collection: 'orderPrivate',
      docId: order.id,
      summary: `Notas internas de ${orderRef(order.id)}`,
    },
  )
}
