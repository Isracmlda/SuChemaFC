import {
  Timestamp,
  arrayUnion,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { timelineEntry } from '../features/admin/orders/review.js'
import {
  SUPPLIER_STATUS,
  affectedOrderIds,
  buildSupplierOrder,
  orderStatusAfterRemoval,
  orderStatusFor,
  supplierLabel,
} from '../features/admin/supplier/supplier.js'
import { statusLabel } from '../features/orders/orderStatus.js'
import { toMillis } from '../utils/dates.js'
import { commitWithAudit } from './audit.js'
import { docRef, getDocData, newDocRef } from './db.js'
import { db } from './firebase.js'

const cut = (text) => String(text).slice(0, 500)
const ts = (ms) => (ms == null ? null : Timestamp.fromMillis(ms))

const SUPPLIER_ORDERS_LIMIT = 200

/** Pedidos a proveedor (los 200 más recientes primero), con fechas en milisegundos. */
export async function listSupplierOrders() {
  const snap = await getDocs(
    query(
      collection(db, 'supplierOrders'),
      orderBy('createdAt', 'desc'),
      limit(SUPPLIER_ORDERS_LIMIT),
    ),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      estimatedDate: toMillis(data.estimatedDate),
      createdAt: toMillis(data.createdAt),
      updates: (data.updates ?? []).map((u) => ({ ...u, at: toMillis(u.at) })),
    }
  })
}

/** Pedidos de clientes afectados: usa los ya cargados y lee los que falten. */
async function resolveOrders(ids, known) {
  const byId = new Map(known.map((o) => [o.id, o]))
  const found = []
  for (const id of ids) {
    const order = byId.get(id) ?? (await getDocData('orders', id))
    if (order) found.push(order)
  }
  return found
}

/**
 * Operaciones para los pedidos de clientes tras un cambio en los pedidos a proveedor:
 * actualiza la fecha estimada del rastreo y, si cambia el estado, también el pedido y el historial.
 * `after` es la lista de pedidos a proveedor ya con el cambio aplicado.
 */
function customerOps(orders, after, estimatedDate, note) {
  const ops = []
  const changes = []
  for (const order of orders) {
    const status = orderStatusFor(order, after)
    const tracking = { estimatedDate: ts(estimatedDate), updatedAt: serverTimestamp() }
    if (status) {
      tracking.status = status
      tracking.timeline = arrayUnion(timelineEntry(status, Timestamp.now(), note))
      ops.push({ type: 'update', ref: docRef('orders', order.id), data: { status } })
      changes.push({ orderId: order.id, status })
    }
    ops.push({ type: 'update', ref: docRef('orderTracking', order.trackingCode), data: tracking })
  }
  return { ops, changes }
}

/**
 * Crea el pedido a proveedor, marca sus camisas y actualiza el rastreo de cada cliente afectado,
 * todo en UN lote con bitácora. `lines` viene de `pendingLines` con `unitCost`.
 */
export async function createSupplierOrder(form, { orders, supplierOrders }) {
  const data = buildSupplierOrder(form)
  const ref = newDocRef('supplierOrders')
  const created = { id: ref.id, ...data }
  const affected = await resolveOrders(affectedOrderIds(created), orders)
  const { ops, changes } = customerOps(
    affected,
    [...supplierOrders, created],
    data.estimatedDate,
    `Tu pedido fue enviado al proveedor.`,
  )
  await commitWithAudit(
    [
      {
        type: 'set',
        ref,
        data: { ...data, estimatedDate: ts(data.estimatedDate), createdAt: serverTimestamp() },
      },
      ...ops,
    ],
    {
      action: 'crear',
      collection: 'supplierOrders',
      docId: ref.id,
      summary: cut(
        `Pedido a ${data.supplier}: ${data.items.length} líneas de ${affected.length} pedidos; ${changes.length} cambian de estado`,
      ),
    },
  )
  return { id: ref.id, changes }
}
/**
 * Elimina un pedido a proveedor. Sus camisas vuelven a "por pedir" y los pedidos de clientes que
 * dependían de él retroceden de estado (con su rastreo), todo en UN lote con bitácora.
 */
export async function deleteSupplierOrder(supplierOrder, { orders, supplierOrders }) {
  const affected = await resolveOrders(affectedOrderIds(supplierOrder), orders)
  const after = supplierOrders.filter((s) => s.id !== supplierOrder.id)
  const ops = []
  let reverted = 0
  for (const order of affected) {
    const status = orderStatusAfterRemoval(order, after)
    if (!status) continue
    reverted += 1
    ops.push({ type: 'update', ref: docRef('orders', order.id), data: { status } })
    ops.push({
      type: 'update',
      ref: docRef('orderTracking', order.trackingCode),
      data: {
        status,
        ...(status === 'adelanto_confirmado' ? { estimatedDate: null } : {}),
        timeline: arrayUnion(
          timelineEntry(status, Timestamp.now(), 'El pedido al proveedor fue anulado.'),
        ),
        updatedAt: serverTimestamp(),
      },
    })
  }
  await commitWithAudit(
    [{ type: 'delete', ref: docRef('supplierOrders', supplierOrder.id) }, ...ops],
    {
      action: 'eliminar',
      collection: 'supplierOrders',
      docId: supplierOrder.id,
      summary: cut(`Pedido a ${supplierOrder.supplier} eliminado; ${reverted} pedidos retroceden`),
    },
  )
  return { reverted }
}

/**
 * Cambia el estado, la fecha estimada o agrega una novedad a un pedido a proveedor y lo refleja en
 * el rastreo de los clientes afectados (también en un solo lote con bitácora).
 */
export async function updateSupplierOrder(
  supplierOrder,
  { status, estimatedDate, note },
  { orders, supplierOrders },
) {
  if (status && !SUPPLIER_STATUS[status]) throw new Error('Estado de proveedor no válido.')
  const next = {
    ...supplierOrder,
    status: status ?? supplierOrder.status,
    estimatedDate: estimatedDate === undefined ? supplierOrder.estimatedDate : estimatedDate,
  }
  const affected = await resolveOrders(affectedOrderIds(next), orders)
  const after = supplierOrders.map((s) => (s.id === next.id ? next : s))
  const text = note?.trim() ?? ''
  const customerNote = text || `El proveedor reporta: ${supplierLabel(next.status).toLowerCase()}.`
  const { ops, changes } = customerOps(affected, after, next.estimatedDate, customerNote)

  const update = { estimatedDate: ts(next.estimatedDate) }
  if (status && status !== supplierOrder.status) update.status = status
  if (status !== supplierOrder.status || text) {
    update.updates = arrayUnion({ status: next.status, at: Timestamp.now(), note: text })
  }
  await commitWithAudit(
    [{ type: 'update', ref: docRef('supplierOrders', supplierOrder.id), data: update }, ...ops],
    {
      action: 'editar',
      collection: 'supplierOrders',
      docId: supplierOrder.id,
      summary: cut(
        `${supplierOrder.supplier}: ${supplierLabel(next.status)}; ${
          changes
            .map((c) => statusLabel(c.status))
            .filter((s, i, a) => a.indexOf(s) === i)
            .join(', ') || 'sin cambios en clientes'
        }`,
      ),
    },
  )
  return { changes, affected }
}
