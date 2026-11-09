import { totalPaid } from '../orders/review.js'

/**
 * Finanzas por pedido al proveedor. Funciones puras.
 *
 * Un pedido de cliente puede repartirse en varios pedidos al proveedor, así que lo que vale y lo que
 * se ha cobrado de un pedido de cliente se reparte según el peso de las camisas que le tocan a cada
 * pedido al proveedor (precio de venta de esas camisas / precio de todas las camisas del pedido).
 */

export const EXPENSE_DESC_MAX = 100
export const EXPENSE_MAX = 100_000_000 // igual que `isMoney` en las reglas

const lineRevenue = (line) => (Number(line?.qty) || 0) * (Number(line?.unitPrice) || 0)
const sum = (list, pick) => list.reduce((n, item) => n + (Number(pick(item)) || 0), 0)

/** ¿El pedido de cliente ya no es una venta (cancelado o eliminado)? */
const isDead = (order) => order.deleted || order.status === 'cancelado'

/**
 * Cifras de un pedido al proveedor:
 * - `cost`: camisas + costos de importación.
 * - `expected`: lo que se espera cobrar por sus camisas (total de cada pedido de cliente, con
 *   descuento y envío, repartido por peso). Los pedidos cancelados o eliminados no cuentan.
 * - `collected`: lo que los clientes ya han pagado de esas camisas.
 * - `profit`: ganancia (o pérdida, si es negativa) hasta hoy = cobrado − costo.
 * - `projected`: ganancia cuando se cobre todo = esperado − costo.
 * - `missing`: camisas cuyo pedido de cliente no se encontró (las cifras quedan incompletas).
 */
export function supplierOrderFinance(supplierOrder, orders) {
  const byId = new Map(orders.map((o) => [o.id, o]))
  const mine = new Map() // orderId -> venta de las camisas de este pedido al proveedor
  let missing = 0
  for (const ref of supplierOrder.lineRefs ?? []) {
    const order = byId.get(ref.orderId)
    const line = order?.lines?.[ref.lineIndex]
    if (!line) {
      missing += 1
      continue
    }
    mine.set(order.id, (mine.get(order.id) ?? 0) + lineRevenue(line))
  }

  let expected = 0
  let collected = 0
  for (const [id, revenue] of mine) {
    const order = byId.get(id)
    const whole = sum(order.lines ?? [], lineRevenue)
    const share = whole > 0 ? revenue / whole : 0
    if (!isDead(order)) expected += (Number(order.total) || 0) * share
    collected += totalPaid(order) * share
  }

  const productCost = Number(supplierOrder.totalCost) || 0
  const importCost = Number(supplierOrder.importCost) || 0
  const cost = productCost + importCost
  expected = Math.round(expected)
  collected = Math.round(collected)
  return {
    id: supplierOrder.id,
    supplier: supplierOrder.supplier,
    status: supplierOrder.status,
    createdAt: supplierOrder.createdAt ?? null,
    units: sum(supplierOrder.items ?? [], (i) => i.qty),
    productCost,
    importCost,
    cost,
    expected,
    collected,
    pending: Math.max(0, expected - collected),
    profit: collected - cost,
    projected: expected - cost,
    missing,
  }
}

/** Una fila de finanzas por cada pedido al proveedor (en el mismo orden de entrada). */
export const financeRows = (supplierOrders, orders) =>
  supplierOrders.map((so) => supplierOrderFinance(so, orders))

/** Suma de filas y costos secundarios: el cuadro general. */
export function totals(rows, expenses = []) {
  const extra = sum(expenses, (e) => e.amount)
  const cost = sum(rows, (r) => r.cost)
  const expected = sum(rows, (r) => r.expected)
  const collected = sum(rows, (r) => r.collected)
  return {
    orders: rows.length,
    cost,
    extra,
    expected,
    collected,
    pending: sum(rows, (r) => r.pending),
    profit: collected - cost - extra,
    projected: expected - cost - extra,
  }
}

/** Clave de agrupación local: "2026-11" por mes o "2026" por año. */
export function periodKey(ms, kind) {
  const d = new Date(ms)
  const year = String(d.getFullYear())
  return kind === 'year' ? year : `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric' })

/** "noviembre de 2026" o "2026" a partir de la clave de `periodKey`. */
export function periodLabel(key) {
  if (!key.includes('-')) return key
  const [year, month] = key.split('-').map(Number)
  return MONTH.format(new Date(year, month - 1, 1))
}

/**
 * Compendio por mes o por año. Cada pedido al proveedor cuenta en el mes en que se creó (con todo
 * lo que se ha cobrado de él hasta hoy) y cada costo secundario en el mes de su fecha.
 * Devuelve las filas más recientes primero.
 */
export function groupFinance(rows, expenses, kind) {
  const groups = new Map()
  const group = (ms) => {
    const key = periodKey(ms, kind)
    if (!groups.has(key)) groups.set(key, { key, rows: [], expenses: [] })
    return groups.get(key)
  }
  for (const r of rows) if (r.createdAt != null) group(r.createdAt).rows.push(r)
  for (const e of expenses) if (e.date != null) group(e.date).expenses.push(e)
  return [...groups.values()]
    .map((g) => ({ ...totals(g.rows, g.expenses), key: g.key, label: periodLabel(g.key) }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

/** Error de texto del formulario de un costo secundario, o '' si es válido. */
export function validateExpense({ description, amount, date }) {
  const text = String(description ?? '').trim()
  if (text.length < 2) return 'Escribe qué compraste (por ejemplo, bolsas).'
  if (text.length > EXPENSE_DESC_MAX) return `Máximo ${EXPENSE_DESC_MAX} caracteres.`
  if (!Number.isInteger(amount) || amount <= 0) return 'El monto debe ser mayor que 0.'
  if (amount > EXPENSE_MAX) return 'El monto es demasiado grande.'
  if (date == null) return 'Elige la fecha.'
  return ''
}

/** Documento `expenses` (sin `createdAt`, que agrega el servicio). */
export const buildExpense = ({ description, amount, date }) => ({
  description: String(description).trim(),
  amount,
  date,
})
