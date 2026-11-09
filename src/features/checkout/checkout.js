import { formatCRC } from '../../utils/format.js'
import { describeCustom } from '../personalization/personalization.js'

export const PROVINCES = [
  'San José',
  'Alajuela',
  'Cartago',
  'Heredia',
  'Guanacaste',
  'Puntarenas',
  'Limón',
]
export const MAX_ORDER_LINES = 30 // igual que el límite de las reglas (orders.lines)
export const NOTE_MAX = 500
export const SHIPPING_METHODS = {
  correos: 'Correos de Costa Rica',
  whatsapp: 'Entrega coordinada por WhatsApp',
}

export const emptyCustomer = (user) => ({
  name: user?.displayName ?? '',
  phone: '',
  email: user?.email ?? '',
  province: '',
  canton: '',
  district: '',
  details: '',
  note: '',
})

/** Teléfono sin símbolos; un número de Costa Rica con prefijo 506 queda en 8 dígitos. */
export function normalizePhone(text = '') {
  let digits = String(text).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('506')) digits = digits.slice(3)
  return digits
}

const isValidPhone = (text) => {
  const digits = normalizePhone(text)
  if (digits.length === 8) return true
  return String(text).trim().startsWith('+') && digits.length >= 9 && digits.length <= 15
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Errores por campo ({} si todo está bien). La dirección solo se exige para Correos. */
export function validateCustomer(form, method) {
  const errors = {}
  const name = form.name.trim()
  if (name.length < 2) errors.name = 'Escribe tu nombre completo.'
  else if (name.length > 100) errors.name = 'El nombre es demasiado largo.'
  if (!isValidPhone(form.phone)) {
    errors.phone = 'Escribe un teléfono de 8 dígitos (o con + y código de país).'
  }
  // El correo es obligatorio: ahí llegan el aviso del pedido, la aprobación del pago y las novedades.
  if (!form.email.trim()) errors.email = 'Escribe tu correo para avisarte del estado de tu pedido.'
  else if (!EMAIL.test(form.email.trim()) || form.email.trim().length > 200) {
    errors.email = 'El correo no es válido.'
  }
  if (form.note.trim().length > NOTE_MAX) errors.note = `Máximo ${NOTE_MAX} caracteres.`

  if (method === 'correos') {
    if (!PROVINCES.includes(form.province)) errors.province = 'Elige tu provincia.'
    if (!form.canton.trim()) errors.canton = 'Escribe tu cantón.'
    if (!form.district.trim()) errors.district = 'Escribe tu distrito.'
    if (form.details.trim().length < 5) errors.details = 'Escribe las señas para llegar.'
    if (form.canton.length > 100) errors.canton = 'Es demasiado largo.'
    if (form.district.length > 100) errors.district = 'Es demasiado largo.'
    if (form.details.length > 300) errors.details = 'Máximo 300 caracteres.'
  }
  return errors
}

/** Mapa `customer` y nota tal como los validan las reglas (sin claves vacías ni undefined). */
export function customerPayload(form, method) {
  const customer = { name: form.name.trim(), phone: normalizePhone(form.phone) }
  if (!customer.phone || String(form.phone).trim().startsWith('+')) {
    customer.phone = String(form.phone).replace(/[^\d+]/g, '')
  }
  if (form.email.trim()) customer.email = form.email.trim()
  if (method === 'correos') {
    customer.address = {
      province: form.province,
      canton: form.canton.trim(),
      district: form.district.trim(),
      details: form.details.trim(),
    }
  }
  const note = form.note.trim()
  return { customer, customerNote: note || null }
}

export const shippingFee = (method, shipping) => (method === 'correos' ? shipping.correosFee : 0)

export const orderTotal = ({ subtotal, discount, shipping }) => subtotal - discount + shipping

/** Adelanto mínimo: el porcentaje configurado redondeado hacia arriba, sin pasar del total. */
export const minAdvance = (total, percent) => Math.min(total, Math.ceil((total * percent) / 100))

/**
 * Líneas del pedido (guardan el nombre y el precio de ese momento) a partir de las de `priceCart`.
 * Con versión, `name` es "Camisa · Versión" (así proveedor, rastreo y WhatsApp la muestran) y se
 * guarda `variantId`; la versión base (sin `variantId`) conserva solo el nombre de la camisa.
 */
export function buildOrderLines(items) {
  return items
    .filter((i) => i.status === 'ok')
    .map((i) => ({
      productId: i.line.productId,
      ...(i.line.variantId ? { variantId: i.line.variantId } : {}),
      name:
        i.line.variantId && i.variantName ? `${i.product.name} · ${i.variantName}` : i.product.name,
      size: i.line.size,
      patches: i.patches.map((p) => ({ group: p.group, name: p.name, price: p.price })),
      custom: i.line.custom
        ? {
            name: i.line.custom.name,
            number: i.line.custom.number,
            ...(i.line.custom.competition ? { competition: i.line.custom.competition } : {}),
          }
        : null,
      qty: i.line.qty,
      unitPrice: i.unit,
    }))
}

/** Resumen público del rastreo: sin datos personales ni precios. */
export const buildTrackingSummary = (lines) =>
  lines.map((l) => ({ name: l.name, size: l.size, qty: l.qty }))

/** Código largo e impredecible (128 bits en hexadecimal). `fill` permite probarlo. */
export function generateTrackingCode(fill = (bytes) => crypto.getRandomValues(bytes)) {
  return Array.from(fill(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Enlace compartible; la app lo lee al entrar (la barra de direcciones solo muestra el dominio). */
export const trackingUrl = (origin, code) => `${origin}/?pedido=${encodeURIComponent(code)}`

/** Enlace wa.me, o '' si no hay número. Un número de 8 dígitos se toma como de Costa Rica. */
export function whatsappLink(number, text) {
  let digits = String(number ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 8) digits = `506${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Mensaje prellenado con el resumen del pedido para el WhatsApp del negocio. */
export function buildWhatsAppMessage({ customerName, code, link, lines, totals, method }) {
  const items = lines.map((l) => {
    const extras = [
      ...l.patches.map((p) => p.name),
      l.custom ? `personalizada ${describeCustom(l.custom)}` : '',
    ].filter(Boolean)
    return `• ${l.qty} × ${l.name} (talla ${l.size}${extras.length ? `, ${extras.join(', ')}` : ''})`
  })
  return [
    `Hola SuChemaFC, soy ${customerName}. Hice un pedido:`,
    ...items,
    '',
    `Total: ${formatCRC(totals.total)}`,
    `Adelanto: ${formatCRC(totals.advanceRequired)}`,
    `Entrega: ${SHIPPING_METHODS[method]}`,
    '',
    `Código: ${code}`,
    `Rastreo: ${link}`,
  ].join('\n')
}

/** Referencia corta del pedido para mencionarla por WhatsApp (los 8 primeros caracteres del ID). */
export const orderRef = (orderId) => String(orderId).slice(0, 8).toUpperCase()

/**
 * Documento `orders` tal como lo validan las reglas (sin `createdAt`, que agrega el servicio con
 * serverTimestamp). Omite las claves opcionales que no aplican en lugar de enviarlas vacías.
 */
export function buildOrder({
  uid,
  trackingCode,
  form,
  method,
  lines,
  subtotal,
  discount,
  couponCode,
  shipping,
  advanceRequired,
  receiptFileId,
}) {
  const { customer, customerNote } = customerPayload(form, method)
  return {
    uid,
    trackingCode,
    customer,
    ...(customerNote ? { customerNote } : {}),
    shippingMethod: method,
    lines,
    subtotal,
    discount,
    shipping,
    total: orderTotal({ subtotal, discount, shipping }),
    ...(couponCode && discount > 0 ? { couponCode } : {}),
    advanceRequired,
    ...(receiptFileId ? { receiptFileId } : {}),
    status: 'pago_pendiente_revision',
    paidAmount: 0,
    payments: [],
    deleted: false,
  }
}
