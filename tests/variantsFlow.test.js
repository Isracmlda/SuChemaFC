import { describe, expect, it } from 'vitest'
import { productReport } from '../src/features/admin/dashboard/stats.js'
import {
  defaultUnitCost,
  groupLines,
  pendingLines,
} from '../src/features/admin/supplier/supplier.js'
import { priceSummary } from '../src/features/catalog/variants.js'
import { addLine, makeLine, priceCart } from '../src/features/cart/cart.js'
import { buildOrderLines, buildTrackingSummary } from '../src/features/checkout/checkout.js'

/**
 * Flujo completo: camisa con 3 versiones (base, mujer hasta XL, niño 16–28 sin recargo), compra de 2
 * unidades con versiones distintas y cómo lo ven carrito, pedido, proveedor y dashboard.
 */
const NOW = Date.UTC(2026, 5, 15, 12)
const product = {
  id: 'real',
  name: 'Real Madrid Local',
  price: 25_000,
  baseVariantName: 'Hombre',
  images: ['BASE'],
  patchGroupIds: [],
  sale: { price: 20_000, startsAt: NOW - 1, endsAt: NOW + 1 }, // oferta de la base
  variants: [
    { id: 'mujer', name: 'Mujer', visible: true, sizes: ['S', 'M', 'L', 'XL'] },
    {
      id: 'nino',
      name: 'Niño',
      visible: true,
      price: 18_000,
      sizes: ['16', '18', '20', '22', '24', '26', '28'],
    },
  ],
}
const catalog = {
  products: [product],
  patchGroups: [],
  surcharges: { sizes: { XL: 2_000 }, personalization: 0 },
}

describe('flujo: 3 versiones y 2 unidades con versiones distintas', () => {
  const lines = addLine(
    addLine([], makeLine({ productId: 'real', size: 'M', variantId: 'mujer' })),
    makeLine({ productId: 'real', size: '16', variantId: 'nino' }),
  )
  const cart = priceCart(lines, catalog, NOW)

  it('carrito: cada versión es su propia línea y su propio precio (la oferta de la base no se hereda)', () => {
    expect(lines).toHaveLength(2)
    const [mujer, nino] = cart.items
    expect(mujer).toMatchObject({ status: 'ok', variantName: 'Mujer', unit: 25_000 })
    expect(nino).toMatchObject({ status: 'ok', variantName: 'Niño', unit: 18_000 }) // 16 sin recargo
    expect(cart.subtotal).toBe(43_000)
  })

  it('carrito: la base sí usa su oferta y una talla que la versión no ofrece queda no disponible', () => {
    const base = priceCart([makeLine({ productId: 'real', size: 'L' })], catalog, NOW)
    expect(base.items[0]).toMatchObject({ status: 'ok', unit: 20_000, variantName: null })
    const xxl = priceCart(
      [makeLine({ productId: 'real', size: '2XL', variantId: 'mujer' })],
      catalog,
      NOW,
    )
    expect(xxl.items[0].status).toBe('unavailable')
    const kid = priceCart([makeLine({ productId: 'real', size: 'M', variantId: 'nino' })], catalog)
    expect(kid.items[0].status).toBe('unavailable')
  })

  const orderLines = buildOrderLines(cart.items)
  const order = {
    id: 'o1',
    status: 'adelanto_confirmado',
    customer: { name: 'Ana' },
    lines: orderLines,
  }

  it('pedido: guarda variantId y "Camisa · Versión"; el rastreo lo muestra sin cambios', () => {
    expect(orderLines.map((l) => l.name)).toEqual([
      'Real Madrid Local · Mujer',
      'Real Madrid Local · Niño',
    ])
    expect(orderLines.map((l) => l.variantId)).toEqual(['mujer', 'nino'])
    expect(buildTrackingSummary(orderLines).map((l) => l.name)).toEqual(
      orderLines.map((l) => l.name),
    )
  })

  it('proveedor: no mezcla versiones y propone el costo de cada versión', () => {
    const pending = pendingLines([order], [])
    expect(groupLines(pending).map((g) => `${g.variantId}|${g.size}`)).toEqual([
      'mujer|M',
      'nino|16',
    ])
    const costs = { real: 12_000 }
    const variantCosts = { real: { nino: 8_000 } }
    expect(defaultUnitCost(pending[0], costs, variantCosts)).toBe(12_000) // mujer: cae al de la camisa
    expect(defaultUnitCost(pending[1], costs, variantCosts)).toBe(8_000)
  })

  it('dashboard: una fila por camisa + versión con su propio costo y margen', () => {
    const paid = { ...order, status: 'entregado' }
    const rows = productReport([paid], { real: 12_000 }, { real: { nino: 8_000 } })
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey['real|mujer']).toMatchObject({ revenue: 25_000, cost: 12_000, margin: 13_000 })
    expect(byKey['real|nino']).toMatchObject({ revenue: 18_000, cost: 8_000, margin: 10_000 })
  })

  it('catálogo: "desde" = mínimo vigente entre base (en oferta) y versiones', () => {
    expect(priceSummary(product, NOW)).toEqual({ min: 18_000, from: true, onSale: true })
  })
})
