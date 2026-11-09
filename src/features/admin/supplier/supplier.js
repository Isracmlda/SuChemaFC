import { formatCRC } from '../../../utils/format.js'
import { buildLabelPayload } from '../delivery/delivery.js'
import { formatAddress, orderRef, trackingUrl, whatsappLink } from '../../checkout/checkout.js'
import { describeCustom } from '../../personalization/personalization.js'

/** Estados de un pedido a proveedor y el estado que provocan en los pedidos de clientes. */
export const SUPPLIER_STATUS = {
  pedido: { label: 'Pedido realizado', rank: 0, orderStatus: 'pedido_al_proveedor' },
  en_produccion: { label: 'En producción', rank: 0, orderStatus: 'pedido_al_proveedor' },
  enviado: { label: 'Enviado', rank: 1, orderStatus: 'en_camino' },
  llego: { label: 'Llegó', rank: 2, orderStatus: 'listo_para_entrega' },
}

export const supplierLabel = (status) => SUPPLIER_STATUS[status]?.label ?? status

export const DEFAULT_LEAD_DAYS = 30
export const MAX_ORDERS_PER_BATCH = 150 // cada pedido suma 2 escrituras; el lote admite 500
const DAY = 86_400_000

/** Fecha estimada por defecto: unos 30 días desde `now`. */
export const defaultEstimate = (now = Date.now()) => now + DEFAULT_LEAD_DAYS * DAY

/** Estados de pedido de cliente que esta etapa puede mover (los demás no se tocan). */
const CHAIN = ['adelanto_confirmado', 'pedido_al_proveedor', 'en_camino', 'listo_para_entrega']

const lineKey = (orderId, lineIndex) => `${orderId}:${lineIndex}`

/** Mapa línea → estado del pedido a proveedor que la contiene. */
export function assignedLines(supplierOrders) {
  const map = new Map()
  for (const so of supplierOrders) {
    for (const ref of so.lineRefs ?? []) map.set(lineKey(ref.orderId, ref.lineIndex), so.status)
  }
  return map
}

/** Líneas de pedidos con adelanto confirmado que aún no están en ningún pedido a proveedor. */
export function pendingLines(orders, supplierOrders) {
  const taken = assignedLines(supplierOrders)
  const out = []
  for (const o of orders) {
    if (o.deleted || o.status !== 'adelanto_confirmado') continue
    o.lines.forEach((line, lineIndex) => {
      const key = lineKey(o.id, lineIndex)
      if (taken.has(key)) return
      out.push({
        key,
        orderId: o.id,
        orderRef: orderRef(o.id),
        lineIndex,
        customerName: o.customer?.name ?? '',
        productId: line.productId,
        variantId: line.variantId ?? null,
        name: line.name,
        size: line.size,
        patches: (line.patches ?? []).map((p) => p.name),
        custom: line.custom ?? null,
        qty: line.qty,
        unitPrice: line.unitPrice,
      })
    })
  }
  return out
}

/** Costo unitario propuesto: el de la versión si `variantCosts` lo define y, si no, el de la camisa. */
export function defaultUnitCost(line, costs = {}, variantCosts = {}) {
  const own = line.variantId ? variantCosts[line.productId]?.[line.variantId] : undefined
  return Number.isFinite(own) ? own : (costs[line.productId] ?? 0)
}

/** Texto de búsqueda y talla opcionales sobre las líneas pendientes. */
export function filterPending(lines, { query = '', size = '' } = {}) {
  const q = query.trim().toLowerCase()
  return lines.filter((l) => {
    if (size && l.size !== size) return false
    if (!q) return true
    return [l.name, l.customerName, l.orderRef].join(' ').toLowerCase().includes(q)
  })
}

/**
 * Agrupa por camisa, versión y talla con la cantidad total (vista rápida de "qué hay que pedir").
 * La versión forma parte de la clave: la M de hombre y la M de mujer no se mezclan.
 */
export function groupLines(lines) {
  const groups = new Map()
  for (const l of lines) {
    const key = l.variantId ? `${l.productId}|${l.variantId}|${l.size}` : `${l.productId}|${l.size}`
    const g = groups.get(key) ?? {
      key,
      productId: l.productId,
      variantId: l.variantId ?? null,
      name: l.name,
      size: l.size,
      qty: 0,
    }
    g.qty += l.qty
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Error del formulario de un pedido a proveedor ('' si es válido). `lines` ya trae `unitCost`. */
export function validateSupplierForm(
  { supplier, notes, estimatedDate, lines, importCost = 0 },
  now = Date.now(),
) {
  if (supplier.trim().length < 2) return 'Escribe el nombre del proveedor.'
  if (supplier.trim().length > 100) return 'El nombre del proveedor es demasiado largo.'
  if (notes.length > 1000) return 'Las notas admiten hasta 1000 caracteres.'
  if (lines.length === 0) return 'Elige al menos una camisa.'
  if (new Set(lines.map((l) => l.orderId)).size > MAX_ORDERS_PER_BATCH) {
    return `Un pedido a proveedor admite hasta ${MAX_ORDERS_PER_BATCH} pedidos de clientes.`
  }
  if (lines.some((l) => !Number.isInteger(l.unitCost) || l.unitCost < 0)) {
    return 'Cada costo unitario debe ser un monto entero (0 o más).'
  }
  if (!Number.isInteger(importCost) || importCost < 0) {
    return 'Los costos de importación deben ser un monto entero (0 o más).'
  }
  if (estimatedDate != null && estimatedDate < now - DAY) {
    return 'La fecha estimada no puede ser pasada.'
  }
  return ''
}

/** Documento `supplierOrders` (sin `createdAt`, que agrega el servicio). */
export function buildSupplierOrder({ supplier, notes, estimatedDate, lines, importCost = 0 }) {
  const items = lines.map((l) => ({
    orderRef: l.orderRef,
    name: l.name,
    size: l.size,
    patches: l.patches,
    custom: l.custom
      ? {
          name: l.custom.name ?? '',
          number: l.custom.number ?? '',
          ...(l.custom.competition ? { competition: l.custom.competition } : {}),
        }
      : null,
    qty: l.qty,
    unitCost: l.unitCost,
    unitPrice: l.unitPrice ?? 0,
  }))
  return {
    supplier: supplier.trim(),
    notes: notes.trim(),
    status: 'pedido',
    lineRefs: lines.map((l) => ({ orderId: l.orderId, lineIndex: l.lineIndex })),
    items,
    totalCost: items.reduce((sum, i) => sum + i.qty * i.unitCost, 0),
    importCost,
    estimatedDate: estimatedDate ?? null,
    updates: [],
  }
}

export const affectedOrderIds = (supplierOrder) => [
  ...new Set((supplierOrder.lineRefs ?? []).map((r) => r.orderId)),
]

/**
 * Estado que debe tener un pedido de cliente según el avance de sus camisas, o null si no cambia.
 * Solo avanza cuando TODAS sus camisas están en pedidos a proveedor, y se queda en la etapa más
 * atrasada. `supplierOrders` debe incluir el pedido recién creado o cambiado.
 */
export function orderStatusFor(order, supplierOrders) {
  if (order.deleted || !CHAIN.includes(order.status)) return null
  const taken = assignedLines(supplierOrders)
  let rank = Infinity
  for (let i = 0; i < order.lines.length; i += 1) {
    const status = taken.get(lineKey(order.id, i))
    if (!status) return null
    rank = Math.min(rank, SUPPLIER_STATUS[status].rank)
  }
  const target = Object.values(SUPPLIER_STATUS).find((s) => s.rank === rank).orderStatus
  return target === order.status ? null : target
}

/**
 * Estado de un pedido de cliente tras quitar un pedido a proveedor (`supplierOrders` ya sin él),
 * o null si no cambia. Si alguna camisa queda sin pedir, vuelve a "adelanto confirmado".
 */
export function orderStatusAfterRemoval(order, supplierOrders) {
  if (order.deleted || !CHAIN.includes(order.status)) return null
  const taken = assignedLines(supplierOrders)
  const allTaken = order.lines.every((_, i) => taken.has(lineKey(order.id, i)))
  if (allTaken) return orderStatusFor(order, supplierOrders)
  return order.status === 'adelanto_confirmado' ? null : 'adelanto_confirmado'
}

// ---------- CSV ----------

/** Celda CSV entre comillas; neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

const CSV_HEADER = [
  'Pedido',
  'Camisa',
  'Talla',
  'Parches',
  'Nombre',
  'Número',
  'Competición',
  'Cantidad',
  'Costo unitario',
  'Costo total',
]

/** CSV del pedido a proveedor (con BOM para que Excel lea bien las tildes). */
export function buildCsv(supplierOrder) {
  const rows = supplierOrder.items.map((i) => [
    i.orderRef,
    i.name,
    i.size,
    (i.patches ?? []).join(' + '),
    i.custom?.name ?? '',
    i.custom?.number ?? '',
    i.custom?.competition ?? '',
    i.qty,
    i.unitCost,
    i.qty * i.unitCost,
  ])
  const total = ['', '', '', '', '', '', '', '', 'Total', supplierOrder.totalCost]
  const lines = [CSV_HEADER, ...rows, total].map((r) => r.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

// ---------- Avisos por WhatsApp ----------

export const DEFAULT_MESSAGE =
  'Hola {nombre}, te escribimos de SuChemaFC sobre tu pedido {pedido}. {estado} ' +
  'Fecha estimada de llegada: {fecha} (puede cambiar si el proveedor se atrasa). ' +
  'Sigue tu pedido aquí: {enlace}'

const LONG_DATE = new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' })

/** Sustituye {nombre}, {pedido}, {estado}, {fecha} y {enlace}; deja intactos los demás textos. */
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (all, key) => (key in vars ? vars[key] : all))
}

/** Enlaces wa.me, uno por cliente afectado: [{ orderId, name, phone, link }]. */
export function customerNotices(orders, supplierOrder, { template, origin }) {
  const date = supplierOrder.estimatedDate
    ? LONG_DATE.format(supplierOrder.estimatedDate)
    : 'por confirmar'
  const estado = `Tu pedido está: ${supplierLabel(supplierOrder.status).toLowerCase()}.`
  return orders.map((o) => {
    const text = fillTemplate(template, {
      nombre: o.customer?.name ?? '',
      pedido: orderRef(o.id),
      estado,
      fecha: date,
      enlace: trackingUrl(origin, o.trackingCode),
    })
    return {
      orderId: o.id,
      name: o.customer?.name ?? '',
      phone: o.customer?.phone ?? '',
      link: whatsappLink(o.customer?.phone, text),
    }
  })
}

export const describeCost = (supplierOrder) =>
  `${supplierOrder.items.reduce((n, i) => n + i.qty, 0)} camisas · ${formatCRC(supplierOrder.totalCost)}`

// ---------- Costos de importación y ganancia ----------

/** Cantidad de camisas (unidades) de un pedido a proveedor. */
export const unitsOf = (supplierOrder) => supplierOrder.items.reduce((n, i) => n + i.qty, 0)

/** Reparto equitativo de los costos de importación entre todas las camisas. */
export const importPerUnit = (importCost, units) => (units > 0 ? importCost / units : 0)

/**
 * Cifras del pedido: costo de camisas, importación (total y por camisa), ingresos de venta de esas
 * camisas y ganancia. `revenue` y `profit` son null en pedidos antiguos que no guardaron el precio
 * de venta. El descuento y el envío del pedido del cliente no se consideran.
 */
export function supplierSummary(supplierOrder) {
  const units = unitsOf(supplierOrder)
  const importCost = supplierOrder.importCost ?? 0
  const productCost = supplierOrder.totalCost
  const priced = supplierOrder.items.every((i) => Number.isFinite(i.unitPrice))
  const revenue = priced ? supplierOrder.items.reduce((n, i) => n + i.qty * i.unitPrice, 0) : null
  return {
    units,
    productCost,
    importCost,
    importPerUnit: importPerUnit(importCost, units),
    totalCost: productCost + importCost,
    revenue,
    profit: revenue == null ? null : revenue - productCost - importCost,
  }
}

// ---------- Etiquetas de entrega ----------

/**
 * Una etiqueta por camisa (una por unidad) para pegar en la bolsa. El QR lleva la guía de rastreo
 * del pedido del cliente: escanearlo en Entrega abre ese pedido. `missing` cuenta las camisas cuyo
 * pedido de cliente no se encontró (no llevan etiqueta). `address` solo se llena en envíos por
 * Correos; en entregas coordinadas por WhatsApp queda vacío.
 */
export function buildLabels(supplierOrder, orders) {
  const byId = new Map(orders.map((o) => [o.id, o]))
  const labels = []
  let missing = 0
  supplierOrder.items.forEach((item, i) => {
    const order = byId.get(supplierOrder.lineRefs?.[i]?.orderId)
    if (!order?.trackingCode || order.deleted || order.status === 'cancelado') {
      missing += item.qty
      return
    }
    for (let copy = 1; copy <= item.qty; copy += 1) {
      labels.push({
        qrPayload: buildLabelPayload(order.trackingCode, supplierOrder.lineRefs?.[i]?.lineIndex),
        ref: orderRef(order.id),
        orderId: order.id,
        customerName: order.customer?.name ?? '',
        shirt: item.name,
        size: item.size,
        patches: item.patches ?? [],
        custom: item.custom ? describeCustom(item.custom) : '',
        address: order.shippingMethod === 'correos' ? formatAddress(order.customer?.address) : '',
        copy,
        copies: item.qty,
      })
    }
  })
  return { labels, missing }
}
