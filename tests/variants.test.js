import { describe, expect, it } from 'vitest'
import { effectivePrice } from '../src/features/catalog/search.js'
import {
  hasVariants,
  minVariantPrice,
  resolveVariant,
  variantSizes,
  visibleVariants,
} from '../src/features/catalog/variants.js'
import { isValidSize, sizeSurcharge, unitPrice } from '../src/features/pricing/price.js'
import { SIZES } from '../src/utils/constants.js'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const activeSale = (price) => ({ price, startsAt: NOW - DAY, endsAt: NOW + DAY })

const standard = { sizes: { '2XL': 1000, '3XL': 2000 }, personalization: 2000 }

const product = {
  id: 'p1',
  name: 'Argentina Local',
  price: 20000,
  images: ['base-1', 'base-2'],
  patchGroupIds: ['g1'],
  sizeSurcharges: { '3XL': 3000 },
  personalization: { enabled: true, surcharge: 4000 },
  sizeChartId: 'adulto',
  sale: activeSale(18000),
  baseVariantName: 'Hombre',
  variants: [
    {
      id: 'mujer',
      name: 'Mujer',
      visible: true,
      price: 19000,
      sizes: ['S', 'M', 'L', 'XL'],
      sale: activeSale(15000),
    },
    {
      id: 'nino',
      name: 'Niño',
      visible: true,
      price: 15000,
      images: ['nino-1'],
      sizes: ['16', '18', '20', '22', '24', '26', '28'],
      patchGroupIds: [],
      sizeChartId: 'nino',
    },
    { id: 'oculta', name: 'Oculta', visible: false, price: 1000 },
  ],
}

describe('versiones: lista y tallas visibles', () => {
  it('visibleVariants omite las ocultas y conserva el orden', () => {
    expect(visibleVariants(product).map((v) => v.id)).toEqual(['mujer', 'nino'])
    expect(visibleVariants({})).toEqual([])
  })

  it('hasVariants distingue productos con y sin versiones', () => {
    expect(hasVariants(product)).toBe(true)
    expect(hasVariants({ price: 1 })).toBe(false)
    expect(hasVariants({ variants: [] })).toBe(false)
    expect(hasVariants({ variants: [{ id: 'x', name: 'X', visible: false }] })).toBe(false)
  })

  it('sin sizes se ofrecen todas las estándar (S a 4XL)', () => {
    expect(variantSizes({ price: 1 }, null)).toEqual(SIZES)
    expect(
      variantSizes({ ...product, variants: [{ id: 'v', name: 'V', visible: true }] }, 'v'),
    ).toEqual(SIZES)
  })

  it('una versión puede ofrecer un subconjunto (mujer hasta XL)', () => {
    expect(variantSizes(product, 'mujer')).toEqual(['S', 'M', 'L', 'XL'])
  })

  it('una versión puede tener tallas propias (niño) en el orden escrito', () => {
    expect(variantSizes(product, 'nino')).toEqual(['16', '18', '20', '22', '24', '26', '28'])
  })

  it('la versión base usa product.sizes si existe', () => {
    expect(variantSizes({ ...product, sizes: ['M', 'S'] }, null)).toEqual(['M', 'S'])
    expect(variantSizes(product, null)).toEqual(SIZES)
  })

  it('una versión oculta o inexistente no ofrece tallas', () => {
    expect(variantSizes(product, 'oculta')).toEqual([])
    expect(variantSizes(product, 'nope')).toEqual([])
  })
})

describe('resolveVariant', () => {
  it('sin variantId devuelve la vista de la versión base', () => {
    const view = resolveVariant(product, null)
    expect(view.price).toBe(20000)
    expect(view.variantId).toBeNull()
    expect(view.variantName).toBe('Hombre')
    expect(view.sale).toEqual(product.sale)
    expect(view.images).toEqual(['base-1', 'base-2'])
    expect(view.variants).toBeUndefined()
  })

  it('usa "Estándar" si falta baseVariantName', () => {
    expect(resolveVariant({ price: 1 }, undefined).variantName).toBe('Estándar')
  })

  it('hereda de la camisa lo que la versión no define', () => {
    const view = resolveVariant(product, 'mujer')
    expect(view.variantId).toBe('mujer')
    expect(view.variantName).toBe('Mujer')
    expect(view.price).toBe(19000)
    expect(view.images).toEqual(['base-1', 'base-2'])
    expect(view.patchGroupIds).toEqual(['g1'])
    expect(view.personalization).toEqual({ enabled: true, surcharge: 4000 })
    expect(view.sizeChartId).toBe('adulto')
    expect(view.sizeSurcharges).toEqual({ '3XL': 3000 })
  })

  it('lo que la versión define gana a la camisa', () => {
    const view = resolveVariant(product, 'nino')
    expect(view.price).toBe(15000)
    expect(view.images).toEqual(['nino-1'])
    expect(view.patchGroupIds).toEqual([])
    expect(view.sizeChartId).toBe('nino')
  })

  it('la oferta de la camisa no se hereda: cada versión usa solo la suya', () => {
    expect(resolveVariant(product, 'nino').sale).toBeUndefined()
    expect(effectivePrice(resolveVariant(product, 'nino'), NOW)).toBe(15000)
    expect(effectivePrice(resolveVariant(product, 'mujer'), NOW)).toBe(15000) // sale propia
    expect(effectivePrice(resolveVariant(product, null), NOW)).toBe(18000) // sale de la base
  })

  it('una versión oculta o con id inexistente no se puede resolver', () => {
    expect(resolveVariant(product, 'oculta')).toBeNull()
    expect(resolveVariant(product, 'nope')).toBeNull()
    expect(resolveVariant(null, null)).toBeNull()
  })

  it('un producto sin versiones se comporta como hoy', () => {
    const plain = { price: 20000, sizeSurcharges: { '3XL': 3000 } }
    const view = resolveVariant(plain, null)
    expect(view).toMatchObject(plain)
    expect(unitPrice(view, [], { size: '3XL' }, NOW, standard)).toBe(
      unitPrice(plain, [], { size: '3XL' }, NOW, standard),
    )
    expect(resolveVariant(plain, 'cualquiera')).toBeNull()
  })
})

describe('minVariantPrice', () => {
  it('toma el menor precio vigente entre la base y las versiones visibles', () => {
    expect(minVariantPrice(product, NOW)).toBe(15000)
  })

  it('ignora las versiones ocultas', () => {
    expect(minVariantPrice(product, NOW)).not.toBe(1000)
  })

  it('sin versiones es el precio vigente de la camisa', () => {
    expect(minVariantPrice({ price: 20000, sale: activeSale(17000) }, NOW)).toBe(17000)
    expect(minVariantPrice({ price: 20000 }, NOW)).toBe(20000)
  })

  it('una oferta vencida no cuenta', () => {
    const expired = {
      price: 20000,
      variants: [
        {
          id: 'v',
          name: 'V',
          visible: true,
          price: 18000,
          sale: { price: 5000, endsAt: NOW - DAY },
        },
      ],
    }
    expect(minVariantPrice(expired, NOW)).toBe(18000)
  })
})

describe('recargo y validez de tallas con versiones', () => {
  it('recargo: versión → camisa → estándar → 0', () => {
    const p = {
      ...product,
      variants: [
        {
          id: 'v',
          name: 'V',
          visible: true,
          sizeSurcharges: { '3XL': 500, XL: 0 },
        },
      ],
    }
    const std = { sizes: { XL: 800, '2XL': 1000, '3XL': 2000 } }
    expect(sizeSurcharge(p, '3XL', std, 'v')).toBe(500) // versión
    expect(sizeSurcharge(p, 'XL', std, 'v')).toBe(0) // 0 propio de la versión gana al estándar
    expect(sizeSurcharge(p, '2XL', std, 'v')).toBe(1000) // estándar
    expect(sizeSurcharge(p, '3XL', std)).toBe(3000) // sin variantId: camisa
    expect(sizeSurcharge(p, 'S', std, 'v')).toBe(0)
  })

  it('las tallas de niño no tienen recargo sin configurar nada', () => {
    for (const size of variantSizes(product, 'nino')) {
      expect(sizeSurcharge(product, size, standard, 'nino')).toBe(0)
    }
    const view = resolveVariant(product, 'nino')
    expect(unitPrice(view, [], { size: '28' }, NOW, standard)).toBe(15000)
  })

  it('mujer conserva el recargo habitual de las estándar que ofrece', () => {
    const p = { ...product, sizeSurcharges: { XL: 1500 } }
    const view = resolveVariant(p, 'mujer')
    expect(unitPrice(view, [], { size: 'XL' }, NOW, standard)).toBe(15000 + 1500)
  })

  it('unitPrice con la vista usa precio, oferta y personalización de la versión', () => {
    const view = resolveVariant(product, 'mujer')
    expect(unitPrice(view, [], { size: 'M', personalized: true }, NOW, standard)).toBe(19000) // oferta 15000 + personalización 4000
  })

  it('isValidSize valida contra las tallas visibles de la versión', () => {
    expect(isValidSize('XL', product, 'mujer')).toBe(true)
    expect(isValidSize('2XL', product, 'mujer')).toBe(false) // no ofrecida por la versión
    expect(isValidSize('20', product, 'nino')).toBe(true)
    expect(isValidSize('M', product, 'nino')).toBe(false)
    expect(isValidSize('2XL', product)).toBe(true) // base: todas las estándar
    expect(isValidSize('M', product, 'oculta')).toBe(false)
    expect(isValidSize('M', product, 'nope')).toBe(false)
  })

  it('isValidSize sin producto sigue validando contra SIZES', () => {
    expect(isValidSize('M')).toBe(true)
    expect(isValidSize('16')).toBe(false)
  })
})
