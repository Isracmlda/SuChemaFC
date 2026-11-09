import { Timestamp, serverTimestamp } from 'firebase/firestore'
import { toMillis } from '../utils/dates.js'
import { commitWithAudit } from './audit.js'
import { ensureSession } from './auth.js'
import { docRef, getDocData, listCollection } from './db.js'
import { normalizeCode } from '../features/pricing/coupon.js'
import { saleUpdateFields } from '../features/pricing/sale.js'

const SUMMARY_MAX = 500
const cut = (text) => String(text).slice(0, SUMMARY_MAX)
const ts = (ms) => (ms == null ? null : Timestamp.fromMillis(ms))

/** Convierte las fechas de un cupón de Firestore a milisegundos para la lógica pura. */
export function normalizeCoupon(c) {
  return {
    ...c,
    startsAt: toMillis(c.startsAt),
    endsAt: toMillis(c.endsAt),
    scope: c.scope ?? { type: 'all', ids: [] },
  }
}

// ---------- Cliente ----------

const COUPON_CACHE_MS = 30_000
const couponCache = new Map() // code -> { at, coupon }

/**
 * Lee un cupón por código (las reglas permiten `get` con cualquier sesión, no listar).
 * Crea la sesión de invitado si hace falta. Devuelve null si no existe. Guarda 30 s en memoria
 * para no repetir la lectura al aplicar el cupón y volver a validarlo.
 */
export async function fetchCoupon(rawCode) {
  const code = normalizeCode(rawCode)
  if (!code) return null
  const hit = couponCache.get(code)
  if (hit && Date.now() - hit.at < COUPON_CACHE_MS) return hit.coupon
  await ensureSession()
  const data = await getDocData('coupons', code).catch((error) => {
    // Un cupón inexistente se lee como "permiso denegado" cuando las reglas dependen de sus campos.
    if (error?.code === 'permission-denied') return null
    throw error
  })
  const coupon = data ? normalizeCoupon(data) : null
  couponCache.set(code, { at: Date.now(), coupon })
  return coupon
}

// ---------- Admin: cupones ----------

export async function listCoupons() {
  const coupons = await listCollection('coupons')
  return coupons.map(normalizeCoupon).sort((a, b) => (b.endsAt ?? 0) - (a.endsAt ?? 0))
}

/**
 * Crea o edita un cupón. El ID es el código, así que no se cambia al editar. Al crear, el uso
 * empieza en 0; al editar nunca se tocan `usedCount` ni `lastOrderId` (los registran los pedidos).
 */
export async function saveCoupon(form, isNew) {
  const code = normalizeCode(form.code)
  const ref = docRef('coupons', code)
  if (isNew && (await getDocData('coupons', code))) {
    throw new Error('Ya existe un cupón con ese código.')
  }
  const data = {
    type: form.type,
    value: form.value,
    scope: { type: form.scope.type, ids: form.scope.type === 'all' ? [] : form.scope.ids },
    minSubtotal: form.minSubtotal,
    startsAt: ts(form.startsAt),
    endsAt: ts(form.endsAt),
    active: form.active,
    maxUses: form.maxUses,
  }
  const op = isNew
    ? { type: 'set', ref, data: { ...data, usedCount: 0, lastOrderId: '' } }
    : { type: 'update', ref, data }
  await commitWithAudit([op], {
    action: isNew ? 'crear' : 'editar',
    collection: 'coupons',
    docId: code,
    summary: cut(`Cupón "${code}"`),
  })
  couponCache.delete(code)
  return code
}

export function setCouponActive(coupon, active) {
  couponCache.delete(coupon.id)
  return commitWithAudit(
    [{ type: 'update', ref: docRef('coupons', coupon.id), data: { active } }],
    {
      action: active ? 'activar' : 'desactivar',
      collection: 'coupons',
      docId: coupon.id,
      summary: cut(`Cupón "${coupon.id}"`),
    },
  )
}

export function deleteCoupon(coupon) {
  couponCache.delete(coupon.id)
  return commitWithAudit([{ type: 'delete', ref: docRef('coupons', coupon.id) }], {
    action: 'eliminar',
    collection: 'coupons',
    docId: coupon.id,
    summary: cut(`Cupón "${coupon.id}"`),
  })
}

// ---------- Admin: ofertas ----------

/**
 * Aplica (o quita) ofertas a varias camisas en un solo lote.
 * `salesByProduct` es un Map id → cambios de esa camisa (el precio depende de cada una). Cada valor es:
 * - un arreglo `[{ variantId: string|null, sale: objeto|null }]` (`variantId` null = camisa base,
 *   `sale` null = quitar la oferta de ese alcance), o
 * - un objeto `sale` suelto (compatibilidad: se aplica a la camisa base; ausente/null la quita).
 * Si solo cambia la base no se toca `variants`; si cambia una versión se reescribe el arreglo completo
 * conservando todo lo demás (ver `saleUpdateFields`).
 */
export function applySales(products, salesByProduct, actionLabel) {
  return commitWithAudit(
    products.map((p) => {
      const entry = salesByProduct.get(p.id) ?? null
      const changes = Array.isArray(entry) ? entry : [{ variantId: null, sale: entry }]
      return {
        type: 'update',
        ref: docRef('products', p.id),
        data: { ...saleUpdateFields(p, changes, ts), updatedAt: serverTimestamp() },
      }
    }),
    {
      action: actionLabel,
      collection: 'products',
      docId: products.length === 1 ? products[0].id : '',
      summary: cut(`${products.length} camisa(s): ${products.map((p) => p.name).join(', ')}`),
    },
  )
}
