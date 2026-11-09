import { FINAL_STATUSES } from '../../orders/orderStatus.js'

/** Estadísticas del dashboard. Funciones puras: reciben los pedidos ya leídos de Firestore. */

export const MAX_ORDERS = 500 // tope de lecturas por consulta del dashboard

export const PERIODS = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
  { id: '90d', label: '90 días', days: 90 },
  { id: 'all', label: 'Todo', days: null },
]

const DAY = 86_400_000

/** Inicio del periodo en milisegundos (0 = sin límite). */
export function periodStart(periodId, now) {
  const days = PERIODS.find((p) => p.id === periodId)?.days
  return days ? now - days * DAY : 0
}

/** Estados con el adelanto ya confirmado: cuentan como venta. */
export const SALE_STATUSES = [
  'adelanto_confirmado',
  'pedido_al_proveedor',
  'en_camino',
  'listo_para_entrega',
  'entregado',
]

export const isSale = (order) => !order.deleted && SALE_STATUSES.includes(order.status)

const sum = (list, pick) => list.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0)
const round1 = (n) => Math.round(n * 10) / 10

/** Cantidad de pedidos por cada estado (incluye los estados en cero). */
export function countStatuses(orders, statuses) {
  const counts = Object.fromEntries(statuses.map((s) => [s, 0]))
  for (const o of orders) if (o.status in counts) counts[o.status] += 1
  return counts
}

/**
 * Costo unitario de una camisa vendida. Si la camisa tiene `variantCosts` ({ productId: { variantId:
 * costo } }), una línea con versión usa el costo de su versión y, si esa versión no tiene costo propio,
 * el de la camisa. Sin `variantCosts` (o sin `variantId`) se usa solo `costs[productId]`.
 */
function lineUnitCost(productId, variantId, costs, variantCosts) {
  const own = variantId ? variantCosts[productId]?.[variantId] : undefined
  if (Number.isFinite(own)) return own
  return Number.isFinite(costs[productId]) ? costs[productId] : null
}

/**
 * Costo y margen por camisa vendida. `costs` es { productId: costo } y `variantCosts` es
 * { productId: { variantId: costo } } (opcional). Cada fila es una camisa + versión (`key`). El costo es
 * solo el de la camisa: los parches y la personalización no tienen costo registrado.
 */
export function productReport(orders, costs, variantCosts = {}) {
  const byProduct = new Map()
  for (const order of orders.filter(isSale)) {
    for (const line of order.lines ?? []) {
      const variantId = line.variantId ?? null
      const key = variantId ? `${line.productId}|${variantId}` : line.productId
      const row = byProduct.get(key) ?? {
        key,
        productId: line.productId,
        variantId,
        name: line.name,
        qty: 0,
        revenue: 0,
      }
      row.qty += line.qty
      row.revenue += line.qty * line.unitPrice
      byProduct.set(key, row)
    }
  }
  return [...byProduct.values()]
    .map((row) => {
      const unitCost = lineUnitCost(row.productId, row.variantId, costs, variantCosts)
      const cost = unitCost == null ? null : unitCost * row.qty
      const margin = cost == null ? null : row.revenue - cost
      return {
        ...row,
        unitCost,
        cost,
        margin,
        marginPct:
          margin == null || row.revenue === 0 ? null : round1((margin / row.revenue) * 100),
      }
    })
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name))
}

/** Resumen general del periodo. */
export function summarize(orders, costs = {}, variantCosts = {}) {
  const sales = orders.filter(isSale)
  const sold = sum(sales, (o) => o.total)
  const collected = sum(sales, (o) => o.paidAmount)
  const discounts = sum(sales, (o) => o.discount)
  const shipping = sum(sales, (o) => o.shipping)
  const products = productReport(orders, costs, variantCosts)
  const costed = products.filter((p) => p.cost != null)
  const revenue = sum(costed, (p) => p.revenue)
  const cost = sum(costed, (p) => p.cost)
  const margin = revenue - cost
  return {
    orders: orders.length,
    inProgress: orders.filter((o) => !o.deleted && !FINAL_STATUSES.includes(o.status)).length,
    sales: {
      count: sales.length,
      sold,
      collected,
      pending: Math.max(0, sold - collected),
      discounts,
      shipping,
      average: sales.length ? Math.round(sold / sales.length) : 0,
    },
    products,
    margin: {
      revenue,
      cost,
      margin,
      marginPct: revenue > 0 ? round1((margin / revenue) * 100) : null,
      withoutCost: products.length - costed.length,
    },
  }
}
