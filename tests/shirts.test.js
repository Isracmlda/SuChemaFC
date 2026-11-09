import { describe, expect, it } from 'vitest'
import {
  blankShirt,
  buildShirtLines,
  changeShirtVariant,
  patchGroupsFor,
  shirtChipLabel,
  shirtInfo,
  shirtView,
  summarizeShirts,
} from '../src/features/catalog/shirts.js'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const activeSale = (price) => ({ price, startsAt: NOW - DAY, endsAt: NOW + DAY })

const standard = { sizes: { '2XL': 1000 }, personalization: 2000 }
const groups = [
  { id: 'g1', name: 'Liga', options: [{ name: 'Copa', image: 'x', price: 1500 }] },
  { id: 'g2', name: 'Otro', options: [{ name: 'Otro', image: 'y', price: 700 }] },
]

const product = {
  id: 'p1',
  name: 'Argentina Local',
  price: 20000,
  images: ['base-1'],
  patchGroupIds: ['g1', 'g2'],
  personalization: { enabled: true, surcharge: 4000 },
  sale: activeSale(18000),
  baseVariantName: 'Hombre',
  variants: [
    { id: 'mujer', name: 'Mujer', visible: true, price: 19000, sizes: ['S', 'M', 'L', 'XL'] },
    {
      id: 'nino',
      name: 'Niño',
      visible: true,
      price: 15000,
      sizes: ['16', '18', '20'],
      patchGroupIds: ['g1'],
      personalization: { enabled: false },
      sizeChartId: 'nino',
    },
  ],
}
const plain = { id: 'p2', name: 'Simple', price: 10000 }
const opts = { catalogGroups: groups, standard, now: NOW }

describe('estado de cada camisa', () => {
  it('blankShirt empieza en la versión base, sin talla, parches ni personalización', () => {
    expect(blankShirt()).toEqual({
      variantId: null,
      size: '',
      patches: {},
      custom: { enabled: false, name: '', number: '', competition: '' },
    })
  })

  it('shirtView resuelve la versión y cae a la base si ya no existe', () => {
    expect(shirtView(product, { variantId: 'nino' }).variantName).toBe('Niño')
    expect(shirtView(product, { variantId: 'borrada' }).variantName).toBe('Hombre')
  })

  it('patchGroupsFor usa los grupos de la versión', () => {
    expect(
      patchGroupsFor(shirtView(product, { variantId: 'nino' }), groups).map((g) => g.id),
    ).toEqual(['g1'])
    expect(patchGroupsFor(shirtView(product, blankShirt()), groups).map((g) => g.id)).toEqual([
      'g1',
      'g2',
    ])
  })
})

describe('changeShirtVariant', () => {
  const filled = {
    variantId: null,
    size: 'M',
    patches: { g1: 0, g2: 0 },
    custom: { enabled: true, name: 'MESSI', number: '10', competition: '' },
  }

  it('conserva la talla si la nueva versión la ofrece', () => {
    const next = changeShirtVariant(filled, product, 'mujer')
    expect(next.variantId).toBe('mujer')
    expect(next.size).toBe('M')
    expect(next.patches).toEqual({ g1: 0, g2: 0 })
    expect(next.custom.name).toBe('MESSI')
  })

  it('limpia talla, parches de grupos que no aplican y personalización no permitida', () => {
    const next = changeShirtVariant(filled, product, 'nino')
    expect(next.size).toBe('')
    expect(next.patches).toEqual({ g1: 0 })
    expect(next.custom).toEqual({ enabled: false, name: '', number: '', competition: '' })
  })

  it('volver a la base (null) también es un cambio válido', () => {
    const toNino = changeShirtVariant(filled, product, 'nino')
    expect(changeShirtVariant(toNino, product, null).variantId).toBe(null)
  })

  it('misma versión o versión inexistente no cambian nada', () => {
    expect(changeShirtVariant(filled, product, null)).toBe(filled)
    expect(changeShirtVariant(filled, product, 'borrada')).toBe(filled)
  })
})

describe('shirtChipLabel', () => {
  it('sin versiones es "Camisa N" (y la talla si ya se eligió)', () => {
    expect(shirtChipLabel(plain, blankShirt(), 0)).toBe('Camisa 1')
    expect(shirtChipLabel(plain, { ...blankShirt(), size: 'L' }, 1)).toBe('Camisa 2 · L')
  })

  it('con versiones incluye versión y talla', () => {
    expect(shirtChipLabel(product, blankShirt(), 0)).toBe('Camisa 1 · Hombre')
    expect(shirtChipLabel(product, { ...blankShirt(), variantId: 'nino', size: '16' }, 1)).toBe(
      'Camisa 2 · Niño · 16',
    )
  })
})

describe('shirtInfo y summarizeShirts', () => {
  it('la oferta de la base no se hereda a las versiones', () => {
    expect(shirtInfo(product, { ...blankShirt(), size: 'M' }, opts).unit).toBe(18000)
    expect(shirtInfo(product, { ...blankShirt(), variantId: 'mujer', size: 'M' }, opts).unit).toBe(
      19000,
    )
  })

  it('suma recargo de talla, parche y personalización de la versión resuelta', () => {
    const shirt = {
      variantId: null,
      size: '2XL',
      patches: { g1: 0 },
      custom: { enabled: true, name: 'ABC', number: '', competition: '' },
    }
    // 18000 oferta + 1000 talla + 1500 parche + 4000 personalización
    expect(shirtInfo(product, shirt, opts).unit).toBe(24500)
  })

  it('la talla no ofrecida por la versión no es válida', () => {
    expect(shirtInfo(product, { ...blankShirt(), variantId: 'nino', size: 'M' }, opts).sizeOk).toBe(
      false,
    )
    expect(
      shirtInfo(product, { ...blankShirt(), variantId: 'nino', size: '18' }, opts).sizeOk,
    ).toBe(true)
  })

  it('una personalización incompleta invalida la camisa', () => {
    const shirt = { ...blankShirt(), size: 'M', custom: { ...blankShirt().custom, enabled: true } }
    expect(shirtInfo(product, shirt, opts).valid).toBe(false)
  })

  it('suma cada camisa con su versión y talla, y reporta las que faltan', () => {
    const shirts = [
      { ...blankShirt(), size: 'M' },
      { ...blankShirt(), variantId: 'nino' },
    ]
    const summary = summarizeShirts(product, shirts, opts)
    expect(summary.total).toBe(18000 + 15000)
    expect(summary.sameUnit).toBe(false)
    expect(summary.missingSize).toEqual([1])
    expect(summary.canAdd).toBe(false)
  })

  it('canAdd solo cuando todas tienen talla y personalización válida', () => {
    const shirts = [
      { ...blankShirt(), size: 'M' },
      { ...blankShirt(), variantId: 'nino', size: '16' },
    ]
    expect(summarizeShirts(product, shirts, opts).canAdd).toBe(true)
  })

  it('sin versiones se comporta como siempre', () => {
    const summary = summarizeShirts(plain, [{ ...blankShirt(), size: 'S' }, blankShirt()], opts)
    expect(summary.sameUnit).toBe(true)
    expect(summary.total).toBe(20000)
    expect(summary.missingSize).toEqual([1])
  })
})

describe('buildShirtLines', () => {
  it('omite variantId en la base, lo incluye en las versiones y junta idénticas', () => {
    const shirts = [
      { ...blankShirt(), size: 'M' },
      { ...blankShirt(), size: 'M' },
      { ...blankShirt(), variantId: 'mujer', size: 'M' },
    ]
    const { infos } = summarizeShirts(product, shirts, opts)
    const lines = buildShirtLines(product, shirts, infos)
    expect(lines).toHaveLength(2)
    expect(lines[0]).not.toHaveProperty('variantId')
    expect(lines[0]).toMatchObject({ productId: 'p1', size: 'M', qty: 2, priceAt: 18000 })
    expect(lines[1]).toMatchObject({ variantId: 'mujer', size: 'M', qty: 1, priceAt: 19000 })
  })

  it('guarda la personalización solo si es válida y está activa', () => {
    const shirts = [
      {
        ...blankShirt(),
        size: 'M',
        custom: { enabled: true, name: 'messi', number: '10', competition: '' },
      },
    ]
    const { infos } = summarizeShirts(product, shirts, opts)
    expect(buildShirtLines(product, shirts, infos)[0].custom).toEqual({
      name: 'MESSI',
      number: '10',
    })
  })
})
