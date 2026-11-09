import { toMillis } from '../../../utils/dates.js'
import { orderRef } from '../../checkout/checkout.js'
import { statusLabel } from '../../orders/orderStatus.js'
import { csvCell } from '../supplier/supplier.js'

/** Respaldo manual: convierte datos de Firestore a CSV o JSON. Funciones puras. */

const iso = (v) => {
  const ms = toMillis(v)
  return ms == null ? '' : new Date(ms).toISOString()
}

/** Reemplaza los Timestamp de Firestore por texto ISO para poder serializar a JSON. */
export function plain(value) {
  if (value && typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}

export const toJson = (data) => JSON.stringify(plain(data), null, 2)

const toCsv = (header, rows) =>
  `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`

const linesText = (order) =>
  (order.lines ?? []).map((l) => `${l.qty} x ${l.name} (${l.size})`).join(' | ')

/** CSV de pedidos: una fila por pedido. */
export function ordersCsv(orders) {
  const header = [
    'Pedido',
    'Fecha',
    'Estado',
    'Cliente',
    'Teléfono',
    'Correo',
    'Camisas',
    'Subtotal',
    'Descuento',
    'Envío',
    'Total',
    'Pagado',
    'Saldo',
    'Cupón',
  ]
  const rows = orders.map((o) => [
    orderRef(o.id),
    iso(o.createdAt),
    o.deleted && o.status === 'cancelado' ? 'Cancelado' : statusLabel(o.status),
    o.customer?.name,
    o.customer?.phone,
    o.customer?.email,
    linesText(o),
    o.subtotal,
    o.discount,
    o.shipping,
    o.total,
    o.paidAmount,
    Math.max(0, (o.total ?? 0) - (o.paidAmount ?? 0)),
    o.couponCode,
  ])
  return toCsv(header, rows)
}

/**
 * Clientes sacados de los pedidos (se agrupan por teléfono). Solo cuenta pedidos no cancelados.
 * Devuelve [{ name, phone, email, orders, spent, last }] ordenado por lo gastado.
 */
export function customersFromOrders(orders) {
  const map = new Map()
  for (const o of orders) {
    if (o.deleted || o.status === 'cancelado' || !o.customer?.phone) continue
    const row = map.get(o.customer.phone) ?? {
      name: o.customer.name,
      phone: o.customer.phone,
      email: o.customer.email ?? '',
      orders: 0,
      spent: 0,
      last: 0,
    }
    row.orders += 1
    row.spent += o.total ?? 0
    const at = toMillis(o.createdAt) ?? 0
    if (at >= row.last) {
      row.last = at
      row.name = o.customer.name
      row.email = o.customer.email ?? row.email
    }
    map.set(o.customer.phone, row)
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name))
}

export function customersCsv(orders) {
  const header = ['Nombre', 'Teléfono', 'Correo', 'Pedidos', 'Total comprado', 'Último pedido']
  const rows = customersFromOrders(orders).map((c) => [
    c.name,
    c.phone,
    c.email,
    c.orders,
    c.spent,
    c.last ? new Date(c.last).toISOString() : '',
  ])
  return toCsv(header, rows)
}

/** CSV del catálogo: una fila por camisa o por versión, con su costo privado si se conoce. */
export function catalogCsv(products, costs = {}, variantCosts = {}) {
  const header = ['ID', 'Nombre', 'Precio', 'Costo', 'Visible', 'Eliminada']
  const rows = []
  for (const p of products) {
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0
    if (!hasVariants) {
      rows.push([
        p.id,
        p.name,
        p.price,
        costs[p.id] ?? '',
        p.visible ? 'sí' : 'no',
        p.deleted ? 'sí' : 'no',
      ])
    } else {
      const baseName = p.baseVariantName?.trim() || 'Estándar'
      rows.push([
        p.id,
        `${p.name} · ${baseName}`,
        p.price,
        costs[p.id] ?? '',
        p.visible ? 'sí' : 'no',
        p.deleted ? 'sí' : 'no',
      ])
      for (const v of p.variants) {
        const vPrice = v.price ?? p.price
        const vCost = variantCosts[p.id]?.[v.id] ?? costs[p.id] ?? ''
        const isVisible = p.visible && v.visible !== false
        rows.push([
          p.id,
          `${p.name} · ${v.name}`,
          vPrice,
          vCost,
          isVisible ? 'sí' : 'no',
          p.deleted ? 'sí' : 'no',
        ])
      }
    }
  }
  return toCsv(header, rows)
}

/** Nombre de archivo con fecha, ej. `suchemafc-pedidos-2026-11-08.csv`. */
export const backupName = (kind, ext, now) =>
  `suchemafc-${kind}-${new Date(now).toISOString().slice(0, 10)}.${ext}`
