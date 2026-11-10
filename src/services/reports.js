import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore'
import { MAX_ORDERS } from '../features/admin/dashboard/stats.js'
import { DEFAULTS_DOC_ID } from './catalog.js'
import { listCollection } from './db.js'
import { db } from './firebase.js'

const ordersRef = () => collection(db, 'orders')
const BATCH = 500
const MAX_EXPORT = 5000

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

/** Pedidos creados desde `startMs` (0 = todos), los más recientes primero y con tope. */
export async function listOrdersSince(startMs, max = MAX_ORDERS) {
  const order = [orderBy('createdAt', 'desc'), limit(max)]
  const q =
    startMs > 0
      ? query(ordersRef(), where('createdAt', '>=', Timestamp.fromMillis(startMs)), ...order)
      : query(ordersRef(), ...order)
  return rows(await getDocs(q))
}

const costsOf = (privates) =>
  Object.fromEntries(
    privates
      .filter((p) => p.id !== DEFAULTS_DOC_ID && Number.isFinite(p.cost))
      .map((p) => [p.id, p.cost]),
  )

/** { productId: costo } desde `productPrivate` (solo admin). */
export async function loadCosts() {
  return costsOf(await listCollection('productPrivate'))
}

/**
 * Costos del dashboard en una sola lectura: `costs` ({ productId: costo }) y `variantCosts`
 * ({ productId: { variantId: costo } }, solo de las camisas que lo definen).
 */
export async function loadCostData() {
  const privates = await listCollection('productPrivate')
  return {
    costs: costsOf(privates),
    variantCosts: Object.fromEntries(
      privates
        .filter((p) => p.variantCosts && typeof p.variantCosts === 'object')
        .map((p) => [p.id, p.variantCosts]),
    ),
  }
}

/** Bitácora: `size` entradas más recientes, o las anteriores a `beforeMs`. */
export async function listAudit(beforeMs = null, size = 100) {
  const base = [collection(db, 'auditLog')]
  const constraints = [
    ...(beforeMs == null ? [] : [where('createdAt', '<', Timestamp.fromMillis(beforeMs))]),
    orderBy('createdAt', 'desc'),
    limit(size),
  ]
  return rows(await getDocs(query(...base, ...constraints)))
}

/** Todos los pedidos (para respaldo), de 500 en 500 y hasta un tope de seguridad. */
export async function listAllOrders() {
  const all = []
  let cursor = null
  while (all.length < MAX_EXPORT) {
    const parts = [ordersRef(), orderBy('createdAt', 'desc')]
    if (cursor) parts.push(startAfter(cursor))
    parts.push(limit(BATCH))
    const snap = await getDocs(query(...parts))
    all.push(...rows(snap))
    if (snap.docs.length < BATCH) break
    cursor = snap.docs.at(-1)
  }
  return all
}
