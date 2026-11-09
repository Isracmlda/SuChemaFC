import { describe, expect, it } from 'vitest'
import {
  couponProblem,
  evaluateCoupon,
  inCouponScope,
  normalizeCode,
  validateCouponForm,
} from '../src/features/pricing/coupon.js'
import {
  buildSale,
  normalizeSale,
  saleScope,
  saleState,
  saleUpdateFields,
  salePriceFor,
  timeLeftText,
  validateSaleInput,
} from '../src/features/pricing/sale.js'
import { effectivePrice } from '../src/features/catalog/salePrice.js'
import { resolveVariant } from '../src/features/catalog/variants.js'
import { fromInputValue, toInputValue } from '../src/utils/dates.js'

const NOW = Date.UTC(2026, 5, 15, 12)
const DAY = 86_400_000

const sections = [
  { id: 'sel', parentId: null },
  { id: 'arg', parentId: 'sel' },
  { id: 'ligas', parentId: null },
]
const item = (id, total, sectionIds = ['arg']) => ({
  status: 'ok',
  total,
  product: { id, sectionIds },
})
const coupon = (over = {}) => ({
  active: true,
  type: 'percent',
  value: 10,
  scope: { type: 'all', ids: [] },
  minSubtotal: 0,
  startsAt: NOW - DAY,
  endsAt: NOW + DAY,
  maxUses: 0,
  usedCount: 0,
  ...over,
})

describe('código de cupón', () => {
  it('queda en mayúsculas, sin tildes ni símbolos', () => {
    expect(normalizeCode('  mundial 26! ')).toBe('MUNDIAL26')
    expect(normalizeCode('ñandú-10_a')).toBe('NANDU-10_A')
    expect(normalizeCode('x'.repeat(60))).toHaveLength(40)
  })
})

describe('vigencia del cupón', () => {
  it('rechaza inexistente, inactivo, futuro, vencido y agotado', () => {
    expect(couponProblem(null, NOW)).toMatch(/no existe/)
    expect(couponProblem(coupon({ active: false }), NOW)).toMatch(/no existe/)
    expect(couponProblem(coupon({ startsAt: NOW + 1 }), NOW)).toMatch(/aún no/)
    expect(couponProblem(coupon({ endsAt: NOW - 1 }), NOW)).toMatch(/venció/)
    expect(couponProblem(coupon({ maxUses: 5, usedCount: 5 }), NOW)).toMatch(/límite/)
  })

  it('acepta uno vigente; maxUses 0 es ilimitado', () => {
    expect(couponProblem(coupon(), NOW)).toBe('')
    expect(couponProblem(coupon({ maxUses: 0, usedCount: 999 }), NOW)).toBe('')
    expect(couponProblem(coupon({ maxUses: 5, usedCount: 4 }), NOW)).toBe('')
  })
})

describe('alcance del cupón', () => {
  it('por secciones incluye las subsecciones', () => {
    const c = coupon({ scope: { type: 'sections', ids: ['sel'] } })
    expect(inCouponScope(c, { id: 'p', sectionIds: ['arg'] }, sections)).toBe(true)
    expect(inCouponScope(c, { id: 'p', sectionIds: ['ligas'] }, sections)).toBe(false)
  })

  it('por camisas solo aplica a las elegidas', () => {
    const c = coupon({ scope: { type: 'products', ids: ['a'] } })
    expect(inCouponScope(c, { id: 'a' }, sections)).toBe(true)
    expect(inCouponScope(c, { id: 'b' }, sections)).toBe(false)
  })
})

describe('descuento del cupón', () => {
  it('porcentaje sobre el subtotal elegible, redondeado hacia abajo', () => {
    const r = evaluateCoupon(coupon({ value: 15 }), [item('a', 12_345)], sections, NOW)
    expect(r).toMatchObject({ ok: true, discount: 1851, eligibleSubtotal: 12_345 })
  })

  it('monto fijo nunca supera lo elegible', () => {
    const r = evaluateCoupon(
      coupon({ type: 'fixed', value: 50_000 }),
      [item('a', 20_000)],
      sections,
      NOW,
    )
    expect(r.discount).toBe(20_000)
  })

  it('solo descuenta las camisas dentro del alcance', () => {
    const c = coupon({ scope: { type: 'sections', ids: ['ligas'] }, value: 10 })
    const r = evaluateCoupon(c, [item('a', 30_000), item('b', 20_000, ['ligas'])], sections, NOW)
    expect(r.discount).toBe(2_000)
    expect(r.eligibleSubtotal).toBe(20_000)
  })

  it('explica por qué no aplica', () => {
    const c = coupon({ scope: { type: 'products', ids: ['zzz'] } })
    expect(evaluateCoupon(c, [item('a', 30_000)], sections, NOW).reason).toMatch(/no aplica/)
    expect(
      evaluateCoupon(coupon({ minSubtotal: 50_000 }), [item('a', 30_000)], sections, NOW).reason,
    ).toMatch(/compra mínima/)
    expect(evaluateCoupon(coupon({ endsAt: NOW - 1 }), [item('a', 30_000)], sections, NOW).ok).toBe(
      false,
    )
  })

  it('el mínimo se mide sobre todo el carrito, no solo lo elegible', () => {
    const c = coupon({ scope: { type: 'products', ids: ['b'] }, minSubtotal: 40_000 })
    const r = evaluateCoupon(c, [item('a', 30_000), item('b', 20_000)], sections, NOW)
    expect(r.ok).toBe(true)
    expect(r.discount).toBe(2_000)
  })

  it('ignora las líneas no disponibles', () => {
    const gone = { status: 'unavailable', total: 0, product: null }
    expect(evaluateCoupon(coupon(), [gone, item('a', 10_000)], sections, NOW).discount).toBe(1_000)
  })
})

describe('formulario de cupón', () => {
  const valid = {
    code: 'verano',
    type: 'percent',
    value: 10,
    scope: { type: 'all', ids: [] },
    minSubtotal: 0,
    maxUses: 0,
    startsAt: NOW,
    endsAt: NOW + DAY,
  }

  it('acepta uno correcto', () => expect(validateCouponForm(valid)).toBe(''))

  it('detecta datos inválidos', () => {
    expect(validateCouponForm({ ...valid, code: '!!!' })).toMatch(/código/)
    expect(validateCouponForm({ ...valid, value: 101 })).toMatch(/porcentaje/)
    expect(validateCouponForm({ ...valid, type: 'fixed', value: 0 })).toMatch(/monto/)
    expect(validateCouponForm({ ...valid, scope: { type: 'sections', ids: [] } })).toMatch(
      /sección/,
    )
    expect(validateCouponForm({ ...valid, startsAt: null })).toMatch(/desde y hasta/)
    expect(validateCouponForm({ ...valid, endsAt: NOW })).toMatch(/posterior/)
    expect(validateCouponForm({ ...valid, maxUses: -1 })).toMatch(/usos/)
  })
})

describe('ofertas', () => {
  const product = { id: 'p', price: 25_000 }

  it('calcula el precio por porcentaje o fijo y exige que baje', () => {
    expect(salePriceFor(product, { mode: 'percent', value: 20 })).toBe(20_000)
    expect(salePriceFor(product, { mode: 'price', value: 18_000 })).toBe(18_000)
    expect(salePriceFor(product, { mode: 'price', value: 25_000 })).toBeNull()
    expect(salePriceFor(product, { mode: 'price', value: 30_000 })).toBeNull()
  })

  it('valida porcentaje, fechas y cuenta regresiva', () => {
    expect(validateSaleInput({ mode: 'percent', value: 95 })).toMatch(/entre 1 y 90/)
    expect(validateSaleInput({ mode: 'price', value: 0 })).toMatch(/precio/)
    expect(validateSaleInput({ mode: 'percent', value: 10, startsAt: 5, endsAt: 5 })).toMatch(
      /posterior/,
    )
    expect(validateSaleInput({ mode: 'percent', value: 10, countdown: true })).toMatch(
      /fecha final/,
    )
    expect(validateSaleInput({ mode: 'percent', value: 10, endsAt: 5, countdown: true })).toBe('')
  })

  it('arma el objeto sale; sin fecha final no hay cuenta regresiva', () => {
    expect(buildSale(product, { mode: 'percent', value: 10, countdown: true })).toEqual({
      price: 22_500,
      startsAt: null,
      endsAt: null,
      countdown: false,
    })
    expect(buildSale(product, { mode: 'price', value: 99_999 })).toBeNull()
  })

  it('estado: activa, programada, vencida o ninguna', () => {
    const sale = (s) => ({ ...product, sale: { price: 20_000, ...s } })
    expect(saleState(product, NOW)).toBe('none')
    expect(saleState(sale({ startsAt: NOW - 1, endsAt: NOW + 1 }), NOW)).toBe('active')
    expect(saleState(sale({ startsAt: NOW + 1 }), NOW)).toBe('scheduled')
    expect(saleState(sale({ endsAt: NOW - 1 }), NOW)).toBe('expired')
    expect(saleState(sale({ price: 30_000 }), NOW)).toBe('none')
  })

  it('texto de cuenta regresiva', () => {
    expect(timeLeftText(NOW + 2 * DAY + 3 * 3_600_000, NOW)).toBe('2 d 3 h')
    expect(timeLeftText(NOW + 5 * 3_600_000 + 10 * 60_000, NOW)).toBe('5 h 10 min')
    expect(timeLeftText(NOW + 30_000, NOW)).toBe('1 min')
    expect(timeLeftText(NOW - 1, NOW)).toBe('')
  })
})

describe('ofertas por versión', () => {
  const stamp = (ms) => ({ toMillis: () => ms }) // imita un Timestamp de Firestore
  const product = {
    id: 'p',
    price: 25_000,
    sale: { price: 20_000, startsAt: null, endsAt: null },
    variants: [
      { id: 'mujer', name: 'Mujer', visible: true, price: 28_000, sizes: ['S', 'M'] },
      { id: 'nino', name: 'Niño', visible: false, sale: { price: 9_000, startsAt: NOW - 1 } },
    ],
  }

  it('el alcance usa el precio de la versión (o el de la base si no define uno)', () => {
    expect(saleScope(product, null).price).toBe(25_000)
    expect(saleScope(product, 'mujer').price).toBe(28_000)
    expect(saleScope(product, 'nino').price).toBe(25_000) // hereda el precio, aunque esté oculta
    expect(saleScope(product, 'nada')).toBeNull()
    expect(salePriceFor(product, { mode: 'percent', value: 50 }, 'mujer')).toBe(14_000)
    expect(salePriceFor(product, { mode: 'price', value: 26_000 }, 'mujer')).toBe(26_000)
    expect(salePriceFor(product, { mode: 'price', value: 26_000 }, 'nada')).toBeNull()
    expect(buildSale(product, { mode: 'percent', value: 10 }, 'mujer').price).toBe(25_200)
  })

  it('el estado de oferta es independiente por alcance', () => {
    expect(saleState(product, NOW)).toBe('active') // la de la base
    expect(saleState(product, NOW, 'mujer')).toBe('none') // no hereda la de la base
    expect(saleState(product, NOW, 'nino')).toBe('active') // la propia de la versión
    expect(saleState(product, NOW - 10, 'nino')).toBe('scheduled')
    expect(saleState(product, NOW, 'nada')).toBe('none')
  })

  it('la oferta de la base no se hereda a las versiones', () => {
    const view = resolveVariant(product, 'mujer')
    expect(view.sale).toBeUndefined()
    expect(effectivePrice(view, NOW)).toBe(28_000)
    expect(effectivePrice(resolveVariant(product, null), NOW)).toBe(20_000)
  })

  it('normalizeSale convierte Timestamps a milisegundos', () => {
    expect(normalizeSale({ price: 1, startsAt: stamp(5), endsAt: null })).toEqual({
      price: 1,
      startsAt: 5,
      endsAt: null,
    })
    expect(normalizeSale(undefined)).toBeNull()
    const variant = {
      id: 'v',
      price: 100,
      visible: true,
      sale: normalizeSale({ price: 50, startsAt: stamp(NOW - 1), endsAt: stamp(NOW + 1) }),
    }
    expect(effectivePrice(resolveVariant({ price: 100, variants: [variant] }, 'v'), NOW)).toBe(50)
  })

  it('escribe solo la base sin tocar variants', () => {
    const fields = saleUpdateFields(product, [{ variantId: null, sale: { price: 1, startsAt: 7 } }])
    expect(Object.keys(fields)).toEqual(['sale'])
    expect(fields.sale).toEqual({ price: 1, startsAt: 7, endsAt: null })
    expect(saleUpdateFields(product, [{ variantId: null, sale: null }])).toEqual({ sale: null })
  })

  it('escribe el sale de una versión y conserva todo lo demás', () => {
    const convert = (ms) => (ms == null ? null : `ts:${ms}`)
    const sale = { price: 24_000, startsAt: 7, endsAt: 9, countdown: true }
    const fields = saleUpdateFields(product, [{ variantId: 'mujer', sale }], convert)
    expect(fields.sale).toBeUndefined() // la base no se toca
    expect(fields.variants).toHaveLength(2)
    expect(fields.variants[0]).toEqual({
      id: 'mujer',
      name: 'Mujer',
      visible: true,
      price: 28_000,
      sizes: ['S', 'M'],
      sale: { price: 24_000, startsAt: 'ts:7', endsAt: 'ts:9', countdown: true },
    })
    // la otra versión conserva su oferta (con la fecha ya convertida) y el producto original no cambia
    expect(fields.variants[1].sale).toEqual({
      price: 9_000,
      startsAt: `ts:${NOW - 1}`,
      endsAt: null,
    })
    expect(product.variants[0].sale).toBeUndefined()
  })

  it('quita la oferta de una versión sin afectar a las demás', () => {
    const fields = saleUpdateFields(product, [{ variantId: 'nino', sale: null }])
    expect(fields.variants[1]).toEqual({ id: 'nino', name: 'Niño', visible: false })
    expect(fields.variants[0]).toBe(product.variants[0])
  })

  it('base y versión a la vez en una sola escritura', () => {
    const fields = saleUpdateFields(product, [
      { variantId: null, sale: null },
      { variantId: 'mujer', sale: { price: 20_000 } },
    ])
    expect(fields.sale).toBeNull()
    expect(fields.variants[0].sale.price).toBe(20_000)
  })
})

describe('fechas de formulario', () => {
  it('ida y vuelta con datetime-local', () => {
    const ms = new Date(2026, 5, 15, 9, 30).getTime()
    expect(toInputValue(ms)).toBe('2026-06-15T09:30')
    expect(fromInputValue('2026-06-15T09:30')).toBe(ms)
    expect(fromInputValue('')).toBeNull()
    expect(toInputValue(null)).toBe('')
  })
})
