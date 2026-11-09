import { describe, expect, it } from 'vitest'
import {
  descendantIds,
  effectivePrice,
  filterProducts,
  isSaleActive,
  sectionPath,
  sortProducts,
} from '../src/features/catalog/search.js'
import {
  personalizationSurcharge,
  sizeSurcharge,
  unitPrice,
} from '../src/features/pricing/price.js'
import { priceSummary } from '../src/features/catalog/variants.js'
import { filterPatchGroups } from '../src/features/admin/catalog/patchFilter.js'
import { normalizeText, slugify } from '../src/utils/format.js'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const sections = [
  { id: 'sel', name: 'Selecciones', parentId: null },
  { id: 'am', name: 'América', parentId: 'sel' },
  { id: 'arg', name: 'Argentina', parentId: 'am' },
  { id: 'clubes', name: 'Clubes', parentId: null },
]
const tags = [
  { id: 'laliga', name: 'laliga', aliases: ['la liga'] },
  { id: 'messi', name: 'messi', aliases: [] },
]
const products = [
  {
    id: 'a',
    name: 'Argentina Local 2026',
    description: '',
    price: 20000,
    sectionIds: ['arg'],
    tagIds: ['messi'],
    createdAt: 3,
  },
  {
    id: 'b',
    name: 'Barcelona Visita',
    description: 'Camiseta azulgrana',
    price: 25000,
    sectionIds: ['clubes'],
    tagIds: ['laliga'],
    createdAt: 2,
  },
  {
    id: 'c',
    name: 'Real Madrid Local',
    description: '',
    price: 30000,
    sale: { price: 22000, startsAt: NOW - DAY, endsAt: NOW + DAY },
    sectionIds: ['clubes'],
    tagIds: ['laliga'],
    createdAt: 1,
  },
]

describe('texto', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizeText('  PasiÓn Ñandú ')).toBe('pasion nandu')
    expect(slugify('La Liga Española!')).toBe('la-liga-espanola')
  })
})

describe('secciones', () => {
  it('encuentra descendientes y la ruta de migas', () => {
    expect([...descendantIds(sections, 'sel')].sort()).toEqual(['am', 'arg', 'sel'])
    expect(sectionPath(sections, 'arg').map((s) => s.name)).toEqual([
      'Selecciones',
      'América',
      'Argentina',
    ])
  })
})

describe('oferta y precio efectivo', () => {
  it('aplica la oferta solo dentro de su vigencia', () => {
    expect(isSaleActive(products[2], NOW)).toBe(true)
    expect(effectivePrice(products[2], NOW)).toBe(22000)
    expect(isSaleActive(products[2], NOW + 2 * DAY)).toBe(false)
    expect(effectivePrice(products[2], NOW + 2 * DAY)).toBe(30000)
    expect(effectivePrice(products[0], NOW)).toBe(20000)
  })

  it('ignora una oferta que no rebaja el precio', () => {
    expect(isSaleActive({ price: 100, sale: { price: 100 } })).toBe(false)
  })
})

describe('búsqueda y filtros', () => {
  const ids = (list) => list.map((p) => p.id)

  it('resuelve hashtags y alias aunque no estén en el nombre', () => {
    expect(ids(filterProducts(products, { query: 'laliga' }, tags, NOW))).toEqual(['b', 'c'])
    expect(ids(filterProducts(products, { query: 'la liga' }, tags, NOW))).toEqual(['b', 'c'])
    expect(ids(filterProducts(products, { query: 'MESSI' }, tags, NOW))).toEqual(['a'])
  })

  it('busca con # solo entre los hashtags de la camisa', () => {
    expect(ids(filterProducts(products, { query: '#LaLiga' }, tags, NOW))).toEqual(['b', 'c'])
    expect(ids(filterProducts(products, { query: '#messi' }, tags, NOW))).toEqual(['a'])
    expect(ids(filterProducts(products, { query: '#inexistente' }, tags, NOW))).toEqual([])
    // un # suelto no filtra nada
    expect(ids(filterProducts(products, { query: '#' }, tags, NOW))).toEqual(['a', 'b', 'c'])
  })

  it('ignora acentos y exige todas las palabras', () => {
    expect(ids(filterProducts(products, { query: 'camiseta azulgrana' }, tags, NOW))).toEqual(['b'])
    expect(ids(filterProducts(products, { query: 'barcelona madrid' }, tags, NOW))).toEqual([])
  })

  it('filtra por sección (con subsecciones), hashtag y precio vigente', () => {
    const sel = descendantIds(sections, 'sel')
    expect(ids(filterProducts(products, { sectionIds: sel }, tags, NOW))).toEqual(['a'])
    expect(ids(filterProducts(products, { tagId: 'laliga' }, tags, NOW))).toEqual(['b', 'c'])
    // 'c' cuesta 22 000 con oferta, así que entra en el rango
    expect(ids(filterProducts(products, { min: 21000, max: 23000 }, tags, NOW))).toEqual(['c'])
  })

  it('ordena', () => {
    expect(ids(sortProducts(products, 'recientes', NOW))).toEqual(['a', 'b', 'c'])
    expect(ids(sortProducts(products, 'precio-asc', NOW))).toEqual(['a', 'c', 'b'])
    expect(ids(sortProducts(products, 'precio-desc', NOW))).toEqual(['b', 'c', 'a'])
    expect(ids(sortProducts(products, 'nombre', NOW))).toEqual(['a', 'b', 'c'])
  })
})

describe('precio de una línea', () => {
  const product = {
    price: 20000,
    sizeSurcharges: { '3XL': 3000 },
    personalization: { enabled: true, surcharge: 4000 },
  }
  const groups = [
    {
      id: 'g1',
      options: [
        { name: 'Liga', price: 2500 },
        { name: 'Copa', price: 3000 },
      ],
    },
  ]

  it('suma talla, parche y personalización', () => {
    expect(unitPrice(product, groups, { size: 'M', patches: {} }, NOW)).toBe(20000)
    expect(
      unitPrice(product, groups, { size: '3XL', patches: { g1: 1 }, personalized: true }, NOW),
    ).toBe(30000)
  })

  it('no cobra personalización si el producto no la permite', () => {
    const off = { ...product, personalization: { enabled: false, surcharge: 4000 } }
    expect(unitPrice(off, groups, { size: 'M', personalized: true }, NOW)).toBe(20000)
  })

  it('usa el precio de oferta como base', () => {
    expect(unitPrice(products[2], [], { size: 'M' }, NOW)).toBe(22000)
  })

  it('toma el recargo estándar de la tienda si la camisa no define uno', () => {
    const standard = { sizes: { M: 1000, '3XL': 5000, '4XL': 6000 }, personalization: 2000 }
    // M y 4XL salen del estándar; 3XL lo cambia la camisa (3000); un 0 propio gana al estándar.
    expect(unitPrice(product, groups, { size: 'M' }, NOW, standard)).toBe(21000)
    expect(unitPrice(product, groups, { size: '3XL' }, NOW, standard)).toBe(23000)
    expect(sizeSurcharge(product, '4XL', standard)).toBe(6000)
    expect(sizeSurcharge({ sizeSurcharges: { M: 0 } }, 'M', standard)).toBe(0)
    expect(sizeSurcharge({}, 'S', standard)).toBe(0)
  })

  it('el recargo de personalización de la camisa gana al estándar; sin él se usa el estándar', () => {
    const standard = { sizes: {}, personalization: 2000 }
    const selection = { size: 'M', personalized: true }
    expect(unitPrice(product, groups, selection, NOW, standard)).toBe(24000) // 20000 + 4000 propio
    const sinPropio = { price: 20000, personalization: { enabled: true } }
    expect(unitPrice(sinPropio, groups, selection, NOW, standard)).toBe(22000)
    expect(
      personalizationSurcharge({ personalization: { enabled: true, surcharge: 0 } }, standard),
    ).toBe(0)
  })
})

describe('filtro de grupos de parches', () => {
  const groups = Array.from({ length: 12 }, (_, i) => ({
    id: `g${i}`,
    name: i === 0 ? 'Champions' : `Grupo ${i}`,
    order: i,
    options: [{ name: i === 1 ? 'Fair Play' : `Op ${i}` }],
  }))

  it('por defecto muestra solo los 10 �ltimos agregados', () => {
    const out = filterPatchGroups(groups)
    expect(out).toHaveLength(10)
    expect(out[0].id).toBe('g11')
    expect(out.some((g) => g.id === 'g0')).toBe(false)
  })

  it('con b�squeda revisa todos, tambi�n por nombre de opci�n', () => {
    expect(filterPatchGroups(groups, { query: 'champions' }).map((g) => g.id)).toEqual(['g0'])
    expect(filterPatchGroups(groups, { query: 'fair play' }).map((g) => g.id)).toEqual(['g1'])
  })

  it('elegidos y todos', () => {
    expect(filterPatchGroups(groups, { mode: 'elegidos', selectedIds: ['g3', 'g0'] })).toHaveLength(
      2,
    )
    expect(filterPatchGroups(groups, { mode: 'todos' })).toHaveLength(12)
  })
})

describe('catalogo con versiones: precio minimo', () => {
  const ids = (list) => list.map((p) => p.id)
  const sale = { price: 12000, startsAt: NOW - DAY, endsAt: NOW + DAY }
  const withVariants = {
    id: 'v',
    name: 'Zeta Con Versiones',
    description: '',
    price: 30000,
    sale: { price: 28000, startsAt: NOW - DAY, endsAt: NOW + DAY },
    createdAt: 0,
    variants: [
      { id: 'nino', name: 'Nino', visible: true, price: 18000 },
      { id: 'oculta', name: 'Oculta', visible: false, price: 1000 },
      { id: 'mujer', name: 'Mujer', visible: true, price: 26000 },
    ],
  }

  it('priceSummary: minimo entre base y versiones visibles, ignorando las ocultas', () => {
    expect(priceSummary(withVariants, NOW)).toEqual({ min: 18000, from: true, onSale: true })
  })

  it('priceSummary: sin versiones o con el mismo precio no es "desde"', () => {
    expect(priceSummary(products[0], NOW)).toEqual({ min: 20000, from: false, onSale: false })
    const same = { price: 20000, variants: [{ id: 'x', name: 'X', visible: true }] }
    expect(priceSummary(same, NOW)).toEqual({ min: 20000, from: false, onSale: false })
  })

  it('la oferta de la base no se hereda; la de una version si cuenta', () => {
    const p = {
      price: 20000,
      sale: { price: 10000 },
      variants: [{ id: 'a', name: 'A', visible: true, price: 15000 }],
    }
    expect(priceSummary(p, NOW).min).toBe(10000)
    const q = { ...p, sale: undefined, variants: [{ ...p.variants[0], sale }] }
    expect(priceSummary(q, NOW)).toEqual({ min: 12000, from: true, onSale: true })
    expect(priceSummary(q, NOW + 2 * DAY).min).toBe(15000)
  })

  it('filterProducts y sortProducts usan el precio minimo vigente', () => {
    const list = [...products, withVariants]
    expect(ids(filterProducts(list, { min: 17000, max: 19000 }, tags, NOW))).toEqual(['v'])
    expect(ids(filterProducts(list, { min: 29000 }, tags, NOW))).toEqual([])
    expect(ids(sortProducts(list, 'precio-asc', NOW))).toEqual(['v', 'a', 'c', 'b'])
    expect(ids(sortProducts(list, 'precio-desc', NOW))).toEqual(['b', 'c', 'a', 'v'])
  })
})
