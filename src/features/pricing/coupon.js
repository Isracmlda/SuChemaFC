import { formatCRC } from '../../utils/format.js'
import { descendantIds } from '../catalog/search.js'

export const COUPON_CODE_MAX = 40
export const COUPON_TYPES = [
  { value: 'percent', label: 'Porcentaje' },
  { value: 'fixed', label: 'Monto fijo (₡)' },
]
export const COUPON_SCOPES = [
  { value: 'all', label: 'Toda la tienda' },
  { value: 'sections', label: 'Secciones' },
  { value: 'products', label: 'Camisas' },
]

/** Código en mayúsculas, sin tildes y solo con letras, números, guion y guion bajo. */
export function normalizeCode(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, COUPON_CODE_MAX)
}

/**
 * Motivo por el que el cupón no se puede usar ahora, o '' si está vigente y con usos disponibles.
 * Fechas en milisegundos. Es una guía para el cliente: la barrera real son las reglas de Firestore.
 */
export function couponProblem(coupon, now = Date.now()) {
  if (!coupon || !coupon.active) return 'Ese cupón no existe o no está activo.'
  if (coupon.startsAt && now < coupon.startsAt) return 'Este cupón aún no está vigente.'
  if (coupon.endsAt && now > coupon.endsAt) return 'Este cupón ya venció.'
  if (coupon.maxUses > 0 && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    return 'Este cupón ya alcanzó su límite de usos.'
  }
  return ''
}

/** ¿Esta camisa entra en el alcance del cupón? `sections` es la lista plana de TODAS las secciones. */
export function inCouponScope(coupon, product, sections) {
  const scope = coupon.scope ?? { type: 'all' }
  if (scope.type === 'products') return (scope.ids ?? []).includes(product.id)
  if (scope.type === 'sections') {
    const allowed = new Set((scope.ids ?? []).flatMap((id) => [...descendantIds(sections, id)]))
    return (product.sectionIds ?? []).some((id) => allowed.has(id))
  }
  return true
}

/**
 * Descuento de un cupón sobre las líneas ya calculadas de `priceCart` (items con status 'ok').
 * Devuelve { ok, reason, discount, eligibleSubtotal }. El descuento es entero, nunca mayor que el
 * subtotal elegible, y el mínimo de compra se mide sobre todo el carrito.
 */
export function evaluateCoupon(coupon, items, sections, now = Date.now()) {
  const fail = (reason) => ({ ok: false, reason, discount: 0, eligibleSubtotal: 0 })
  const problem = couponProblem(coupon, now)
  if (problem) return fail(problem)

  const available = items.filter((i) => i.status === 'ok')
  const subtotal = available.reduce((sum, i) => sum + i.total, 0)
  const min = coupon.minSubtotal ?? 0
  if (subtotal < min) return fail(`Este cupón requiere una compra mínima de ${formatCRC(min)}.`)

  const eligibleSubtotal = available
    .filter((i) => inCouponScope(coupon, i.product, sections))
    .reduce((sum, i) => sum + i.total, 0)
  if (eligibleSubtotal === 0) return fail('Este cupón no aplica a las camisas de tu carrito.')

  const raw =
    coupon.type === 'percent' ? Math.floor((eligibleSubtotal * coupon.value) / 100) : coupon.value
  const discount = Math.min(Math.max(0, raw), eligibleSubtotal)
  return { ok: true, reason: '', discount, eligibleSubtotal }
}

/** Texto con el primer problema del formulario de cupón del admin, o '' si es válido. */
export function validateCouponForm(form) {
  if (!normalizeCode(form.code)) return 'Escribe un código (letras, números, guion).'
  if (form.type === 'percent') {
    if (!Number.isInteger(form.value) || form.value < 1 || form.value > 100) {
      return 'El porcentaje debe ser un entero entre 1 y 100.'
    }
  } else if (!Number.isInteger(form.value) || form.value < 1) {
    return 'Escribe el monto del descuento en colones.'
  }
  if (form.scope.type !== 'all' && form.scope.ids.length === 0) {
    return form.scope.type === 'sections'
      ? 'Elige al menos una sección.'
      : 'Elige al menos una camisa.'
  }
  if (!Number.isInteger(form.minSubtotal) || form.minSubtotal < 0)
    return 'El mínimo de compra no es válido.'
  if (!Number.isInteger(form.maxUses) || form.maxUses < 0) return 'El límite de usos no es válido.'
  if (form.startsAt == null || form.endsAt == null) {
    return 'Indica desde y hasta cuándo es válido (los usos se registran solo dentro de ese rango).'
  }
  if (form.endsAt <= form.startsAt) return 'La fecha final debe ser posterior a la inicial.'
  return ''
}

/**
 * Resultado del cupón aplicado para mostrar y cobrar. `applied` es la salida de `useCoupon`.
 * Devuelve null mientras carga, si falló la lectura o si no hay cupón aplicado.
 */
export function couponOutcome(code, applied, items, sections, now = Date.now()) {
  if (!code) return null
  if (applied.coupon) return evaluateCoupon(applied.coupon, items, sections, now)
  if (applied.loading || applied.error) return null
  return { ok: false, reason: 'Ese cupón ya no existe.', discount: 0, eligibleSubtotal: 0 }
}
