import { isSaleActive } from '../catalog/salePrice.js'
import { toMillis } from '../../utils/dates.js'

/**
 * Ofertas por alcance. Una oferta vive en la camisa base (`product.sale`) o en una versión
 * (`product.variants[i].sale`). La de la base NO se hereda a las versiones: cada alcance se evalúa solo
 * con su propio precio y su propia oferta.
 */

/** Fechas de una oferta (Timestamp de Firestore o número) a milisegundos. Acepta null. */
export function normalizeSale(sale) {
  return sale ? { ...sale, startsAt: toMillis(sale.startsAt), endsAt: toMillis(sale.endsAt) } : null
}

/**
 * `{ price, sale }` del alcance: la camisa base (`variantId` vacío) o una versión (aunque esté oculta,
 * porque el administrador puede preparar su oferta). Una versión sin precio propio usa el de la base.
 * Devuelve null si la versión no existe.
 */
export function saleScope(product, variantId = null) {
  if (variantId == null || variantId === '') return { price: product.price, sale: product.sale }
  const variant = (product.variants ?? []).find((v) => v?.id === variantId)
  return variant ? { price: variant.price ?? product.price, sale: variant.sale } : null
}

export const SALE_MODES = [
  { value: 'percent', label: 'Porcentaje de descuento' },
  { value: 'price', label: 'Precio fijo de oferta' },
]

export const MAX_SALE_PERCENT = 90

/**
 * Precio de oferta de una camisa según el modo, o null si no queda por debajo del precio del alcance
 * (base o `variantId`). input: { mode: 'percent' | 'price', value }
 */
export function salePriceFor(product, { mode, value }, variantId = null) {
  const scope = saleScope(product, variantId)
  if (!scope) return null
  const price = mode === 'percent' ? Math.round(scope.price * (1 - value / 100)) : value
  return Number.isInteger(price) && price > 0 && price < scope.price ? price : null
}

/** Texto con el primer problema de los datos de la oferta, o '' si son válidos. */
export function validateSaleInput({ mode, value, startsAt, endsAt, countdown }) {
  if (mode === 'percent') {
    if (!Number.isInteger(value) || value < 1 || value > MAX_SALE_PERCENT) {
      return `El descuento debe ser un porcentaje entero entre 1 y ${MAX_SALE_PERCENT}.`
    }
  } else if (!Number.isInteger(value) || value < 1) {
    return 'Escribe el precio de oferta en colones.'
  }
  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return 'La fecha final debe ser posterior a la inicial.'
  }
  if (countdown && endsAt == null) return 'La cuenta regresiva necesita una fecha final.'
  return ''
}

/** Objeto `sale` para guardar en la camisa o en una versión, o null si el precio no queda rebajado. */
export function buildSale(product, input, variantId = null) {
  const price = salePriceFor(product, input, variantId)
  if (price == null) return null
  return {
    price,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    countdown: Boolean(input.countdown && input.endsAt != null),
  }
}

/**
 * Campos de `products/{id}` a escribir para un conjunto de cambios de oferta de UNA camisa.
 * changes: [{ variantId: string|null, sale: object|null }] (null = quitar la oferta de ese alcance).
 * - Solo cambios de la base → `{ sale }` y no se toca `variants`.
 * - Con cambios en versiones → `variants` completo (Firestore reemplaza el arreglo): se clona, solo se
 *   modifica el `sale` de las versiones indicadas y se conserva todo lo demás.
 * `convert` transforma cada fecha (ms → Timestamp) y se aplica a toda oferta que se escriba, también a
 * las de versiones no modificadas, para no dejar números donde había Timestamps.
 */
export function saleUpdateFields(product, changes, convert = (ms) => ms) {
  const toStored = (sale) =>
    sale && {
      ...sale,
      startsAt: convert(toMillis(sale.startsAt)),
      endsAt: convert(toMillis(sale.endsAt)),
    }
  const fields = {}
  const variantChanges = new Map()
  for (const { variantId, sale } of changes) {
    if (variantId == null || variantId === '') fields.sale = toStored(sale)
    else variantChanges.set(variantId, sale)
  }
  if (variantChanges.size) {
    fields.variants = (product.variants ?? []).map((v) => {
      if (!variantChanges.has(v?.id)) return v?.sale ? { ...v, sale: toStored(v.sale) } : v
      const { sale: _old, ...rest } = v
      const sale = variantChanges.get(v.id)
      return sale ? { ...rest, sale: toStored(sale) } : rest
    })
  }
  return fields
}

/** 'none' | 'active' | 'scheduled' | 'expired' (fechas en milisegundos) del alcance base o `variantId`. */
export function saleState(product, now = Date.now(), variantId = null) {
  const scope = saleScope(product, variantId)
  const sale = scope?.sale
  if (!sale || !Number.isFinite(sale.price)) return 'none'
  if (isSaleActive(scope, now)) return 'active'
  if (sale.startsAt && now < sale.startsAt) return 'scheduled'
  if (sale.endsAt && now > sale.endsAt) return 'expired'
  return 'none'
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Tiempo restante legible: "2 d 3 h", "5 h 10 min" o "12 min". Vacío si ya terminó. */
export function timeLeftText(endsAt, now = Date.now()) {
  const left = endsAt - now
  if (!(left > 0)) return ''
  const days = Math.floor(left / DAY)
  const hours = Math.floor((left % DAY) / HOUR)
  const minutes = Math.max(1, Math.floor((left % HOUR) / MINUTE))
  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}
