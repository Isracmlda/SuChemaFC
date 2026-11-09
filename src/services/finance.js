import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { buildExpense } from '../features/admin/finance/finance.js'
import { toMillis } from '../utils/dates.js'
import { formatCRC } from '../utils/format.js'
import { listOrders } from './adminOrders.js'
import { commitWithAudit } from './audit.js'
import { docRef, getDocData, newDocRef } from './db.js'
import { db } from './firebase.js'
import { listSupplierOrders } from './supplierOrders.js'

const EXPENSES_LIMIT = 500

/** Costos secundarios (insumos), los más recientes primero, con la fecha en milisegundos. */
export async function listExpenses() {
  const snap = await getDocs(
    query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(EXPENSES_LIMIT)),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, ...data, date: toMillis(data.date), createdAt: toMillis(data.createdAt) }
  })
}

/**
 * Todo lo que necesitan las finanzas: pedidos al proveedor, costos secundarios y los pedidos de
 * clientes que esos pedidos mencionan (los recientes vienen de la caché; los demás se leen aparte).
 */
export async function loadFinance() {
  const [supplierOrders, expenses, recent] = await Promise.all([
    listSupplierOrders(),
    listExpenses(),
    listOrders(),
  ])
  const known = new Set(recent.map((o) => o.id))
  const wanted = new Set(supplierOrders.flatMap((so) => (so.lineRefs ?? []).map((r) => r.orderId)))
  const extra = await Promise.all(
    [...wanted].filter((id) => !known.has(id)).map((id) => getDocData('orders', id)),
  )
  return { supplierOrders, expenses, orders: [...recent, ...extra.filter(Boolean)] }
}

/** Registra un costo secundario (con bitácora). */
export async function addExpense(form) {
  const data = buildExpense(form)
  const ref = newDocRef('expenses')
  await commitWithAudit(
    [
      {
        type: 'set',
        ref,
        data: { ...data, date: Timestamp.fromMillis(data.date), createdAt: serverTimestamp() },
      },
    ],
    {
      action: 'crear',
      collection: 'expenses',
      docId: ref.id,
      summary: `Costo secundario: ${data.description} (${formatCRC(data.amount)})`.slice(0, 500),
    },
  )
  return ref.id
}

/** Elimina un costo secundario (con bitácora). */
export async function deleteExpense(expense) {
  await commitWithAudit([{ type: 'delete', ref: docRef('expenses', expense.id) }], {
    action: 'eliminar',
    collection: 'expenses',
    docId: expense.id,
    summary:
      `Costo secundario eliminado: ${expense.description} (${formatCRC(expense.amount)})`.slice(
        0,
        500,
      ),
  })
}
