import {
  Timestamp,
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import {
  buildOrder,
  buildTrackingSummary,
  generateTrackingCode,
} from '../features/checkout/checkout.js'
import { normalizeCheckoutSettings } from '../features/checkout/settings.js'
import { commitWithAudit } from './audit.js'
import { ensureSession } from './auth.js'
import { clearReadCache, docRef, getDocDataCached, listCollection, newDocRef } from './db.js'
import { db } from './firebase.js'

const SUMMARY_MAX = 500
const cut = (text) => String(text).slice(0, SUMMARY_MAX)

// ---------- Ajustes de la tienda (lectura pública) ----------

export async function loadCheckoutSettings() {
  // Comparte la caché con Ayuda y el botón de WhatsApp: los mismos documentos no se leen dos veces.
  const [payment, shipping, general, methods] = await Promise.all([
    getDocDataCached('settings', 'payment'),
    getDocDataCached('settings', 'shipping'),
    getDocDataCached('settings', 'general'),
    listCollection('paymentMethods'),
  ])
  return normalizeCheckoutSettings({ payment, shipping, general }, methods)
}

// ---------- Crear el pedido ----------

/**
 * Crea el pedido, su rastreo público y (si hay cupón) el registro de uso, todo en UN lote: o se
 * guarda todo o nada. Las reglas exigen ese lote. El comprobante ya debe estar subido a Drive
 * (`receiptFileId`), así un reintento tras un fallo no lo sube dos veces.
 * Devuelve { orderId, trackingCode }.
 */
export async function placeOrder({ receiptFileId, items, ...data }) {
  const user = await ensureSession()

  const orderRef = newDocRef('orders')
  const trackingCode = generateTrackingCode()
  const order = buildOrder({
    ...data,
    uid: user.uid,
    trackingCode,
    lines: items,
    receiptFileId,
  })

  const batch = writeBatch(db)
  batch.set(orderRef, { ...order, createdAt: serverTimestamp() })
  batch.set(doc(collection(db, 'orderTracking'), trackingCode), {
    orderId: orderRef.id,
    status: order.status,
    // serverTimestamp no se permite dentro de listas: la hora del evento inicial es la del equipo.
    timeline: [{ status: order.status, at: Timestamp.now(), note: '' }],
    summary: buildTrackingSummary(items),
    estimatedDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (order.couponCode) {
    batch.update(docRef('coupons', order.couponCode), {
      usedCount: increment(1),
      lastOrderId: orderRef.id,
    })
  }
  try {
    await batch.commit()
  } catch (error) {
    // Si el admin cambió el adelanto, las reglas rechazan el pedido: al reintentar se lee de nuevo.
    clearReadCache()
    throw error
  }
  clearReadCache() // el uso del cupón cambió
  return { orderId: orderRef.id, trackingCode }
}

// ---------- Admin: ajustes y métodos de pago ----------

/** Guarda porcentaje de adelanto, envío y WhatsApp en un lote con bitácora. */
export function saveStoreSettings({ advancePercent, shipping, whatsappNumber }) {
  return commitWithAudit(
    [
      {
        type: 'set',
        ref: docRef('settings', 'payment'),
        data: { advancePercent },
        merge: true,
      },
      { type: 'set', ref: docRef('settings', 'shipping'), data: shipping, merge: true },
      {
        type: 'set',
        ref: docRef('settings', 'general'),
        data: { whatsappNumber: String(whatsappNumber).replace(/[^\d]/g, '') },
        merge: true,
      },
    ],
    {
      action: 'editar',
      collection: 'settings',
      docId: 'payment,shipping,general',
      summary: cut(`Adelanto ${advancePercent}%, envío y WhatsApp`),
    },
  )
}

export async function savePaymentMethod(method, count = 0) {
  const isNew = !method.id
  const ref = isNew ? newDocRef('paymentMethods') : docRef('paymentMethods', method.id)
  const data = {
    type: method.type,
    number: method.number.trim(),
    holder: method.holder.trim(),
    notes: method.notes.trim(),
    order: isNew ? count : method.order,
    visible: method.visible,
  }
  await commitWithAudit([{ type: 'set', ref, data }], {
    action: isNew ? 'crear' : 'editar',
    collection: 'paymentMethods',
    docId: ref.id,
    summary: cut(`Método de pago "${data.type}" de ${data.holder}`),
  })
  return ref.id
}

export function deletePaymentMethod(method) {
  return commitWithAudit([{ type: 'delete', ref: docRef('paymentMethods', method.id) }], {
    action: 'eliminar',
    collection: 'paymentMethods',
    docId: method.id,
    summary: cut(`Método de pago de ${method.holder}`),
  })
}
