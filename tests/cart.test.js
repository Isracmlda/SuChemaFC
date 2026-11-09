import { describe, expect, it } from 'vitest'
import {
  MAX_LINES,
  MAX_QTY,
  acknowledgePrices,
  addLine,
  canAddLine,
  cartCount,
  lineKey,
  makeLine,
  mergeIds,
  mergeLines,
  priceCart,
  removeLine,
  sanitizeIds,
  sanitizeLines,
  setLineQty,
  toggleId,
} from '../src/features/cart/cart.js'

const shirt = { productId: 'p1', size: 'M', patches: {}, custom: null }

describe('llave de línea', () => {
  it('es la misma sin importar el orden de los parches ni los nulos', () => {
    const a = lineKey({ ...shirt, patches: { g2: 1, g1: 0, g3: null } })
    const b = lineKey({ ...shirt, patches: { g1: 0, g2: 1 } })
    expect(a).toBe(b)
  })

  it('cambia con talla, parche o personalización', () => {
    const base = lineKey(shirt)
    expect(lineKey({ ...shirt, size: 'L' })).not.toBe(base)
    expect(lineKey({ ...shirt, patches: { g1: 0 } })).not.toBe(base)
    expect(lineKey({ ...shirt, custom: { name: 'LEO', number: '10' } })).not.toBe(base)
  })

  it('la versión distingue líneas y una línea sin versión conserva su llave de siempre', () => {
    const base = lineKey(shirt)
    expect(base).toBe('p1|M||')
    expect(lineKey({ ...shirt, variantId: '' })).toBe(base)
    expect(lineKey({ ...shirt, variantId: null })).toBe(base)
    expect(lineKey({ ...shirt, variantId: 'mujer' })).not.toBe(base)
    expect(lineKey({ ...shirt, variantId: 'mujer' })).not.toBe(
      lineKey({ ...shirt, variantId: 'nino' }),
    )
  })

  it('una personalización vacía equivale a no personalizar', () => {
    expect(lineKey({ ...shirt, custom: { name: '', number: '' } })).toBe(lineKey(shirt))
  })

  it('la competición distingue líneas con el mismo nombre y número', () => {
    const custom = { name: 'LEO', number: '10' }
    const liga = lineKey({ ...shirt, custom: { ...custom, competition: 'Liga' } })
    const champions = lineKey({ ...shirt, custom: { ...custom, competition: 'Champions' } })
    expect(liga).not.toBe(champions)
    expect(liga).not.toBe(lineKey({ ...shirt, custom }))
    expect(makeLine({ ...shirt, custom: { ...custom, competition: 'Liga' } }).custom).toEqual({
      ...custom,
      competition: 'Liga',
    })
    expect(makeLine({ ...shirt, custom }).custom).toEqual(custom)
  })
})

describe('operaciones del carrito', () => {
  it('suma la cantidad de una línea repetida con tope', () => {
    let lines = addLine([], makeLine({ ...shirt, qty: 8, priceAt: 100 }))
    lines = addLine(lines, makeLine({ ...shirt, qty: 5, priceAt: 120 }))
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(MAX_QTY)
    expect(lines[0].priceAt).toBe(120)
  })

  it('no agrega líneas nuevas cuando está lleno, pero sí suma a las existentes', () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) =>
      makeLine({ ...shirt, productId: `p${i}` }),
    )
    const extra = makeLine({ ...shirt, productId: 'otra' })
    expect(canAddLine(full, extra)).toBe(false)
    expect(addLine(full, extra)).toBe(full)
    expect(canAddLine(full, full[0])).toBe(true)
  })

  it('no mezcla la misma camisa en distinta versión, pero sí suma la misma versión', () => {
    let lines = addLine([], makeLine({ ...shirt, variantId: 'mujer' }))
    lines = addLine(lines, makeLine({ ...shirt, variantId: 'nino' }))
    lines = addLine(lines, makeLine(shirt))
    lines = addLine(lines, makeLine({ ...shirt, variantId: 'mujer' }))
    expect(lines).toHaveLength(3)
    expect(lines.find((l) => l.variantId === 'mujer').qty).toBe(2)
  })

  it('makeLine guarda variantId solo si existe', () => {
    expect(makeLine({ ...shirt, variantId: 'mujer' }).variantId).toBe('mujer')
    expect('variantId' in makeLine(shirt)).toBe(false)
    expect('variantId' in makeLine({ ...shirt, variantId: '' })).toBe(false)
  })

  it('ajusta la cantidad entre 1 y el máximo, y elimina', () => {
    const line = makeLine(shirt)
    expect(setLineQty([line], line.key, 0)[0].qty).toBe(1)
    expect(setLineQty([line], line.key, 99)[0].qty).toBe(MAX_QTY)
    expect(removeLine([line], line.key)).toEqual([])
  })

  it('cuenta unidades, no líneas', () => {
    expect(
      cartCount([makeLine({ ...shirt, qty: 2 }), makeLine({ ...shirt, size: 'L', qty: 3 })]),
    ).toBe(5)
  })

  it('acepta el aviso de precio guardando el precio actual', () => {
    const line = makeLine({ ...shirt, priceAt: 100 })
    expect(acknowledgePrices([line], { [line.key]: 150 })[0].priceAt).toBe(150)
  })
})

describe('fusión local y remoto', () => {
  it('conserva la mayor cantidad y no duplica', () => {
    const local = [makeLine({ ...shirt, qty: 2 })]
    const remote = [makeLine({ ...shirt, qty: 3 }), makeLine({ ...shirt, size: 'L' })]
    const merged = mergeLines(local, remote)
    expect(merged).toHaveLength(2)
    expect(merged.find((l) => l.size === 'M').qty).toBe(3)
    expect(mergeLines(merged, merged)).toHaveLength(2)
  })

  it('une las listas de deseos sin repetir', () => {
    expect(mergeIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('alterna un favorito', () => {
    expect(toggleId(['a'], 'b')).toEqual(['b', 'a'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('datos guardados', () => {
  it('descarta basura y repetidos', () => {
    const lines = sanitizeLines([
      { productId: 'p1', size: 'M', qty: 2 },
      { productId: 'p1', size: 'M', qty: 5 },
      { productId: 3, size: 'M' },
      null,
      { productId: 'p2' },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(2)
    expect(sanitizeLines('no es lista')).toEqual([])
    expect(sanitizeIds(['a', 'a', 5, '', 'b'])).toEqual(['a', 'b'])
  })

  it('conserva la versión y no confunde versiones; las líneas viejas mantienen su llave', () => {
    const saved = [
      { productId: 'p1', size: 'M', qty: 1 },
      { productId: 'p1', size: 'M', variantId: 'mujer', qty: 2 },
      { productId: 'p1', size: 'M', variantId: 7, qty: 1 },
    ]
    const lines = sanitizeLines(saved)
    expect(lines).toHaveLength(2)
    expect(lines[0].key).toBe('p1|M||')
    expect('variantId' in lines[0]).toBe(false)
    expect(lines[1].variantId).toBe('mujer')
    // Releer lo ya sanitizado no cambia nada (ida y vuelta por localStorage / Firestore).
    expect(sanitizeLines(lines)).toEqual(lines)
  })
})

describe('priceCart', () => {
  const product = {
    id: 'p1',
    price: 20000,
    sale: null,
    sizeSurcharges: { XL: 2000 },
    patchGroupIds: ['g1'],
    personalization: { enabled: true, surcharge: 3000 },
  }
  const catalog = {
    products: [product],
    patchGroups: [{ id: 'g1', name: 'Liga', options: [{ name: 'Champions', price: 1500 }] }],
  }

  it('calcula talla, parche y personalización', () => {
    const line = makeLine({
      productId: 'p1',
      size: 'XL',
      patches: { g1: 0 },
      custom: { name: 'LEO', number: '10' },
      qty: 2,
    })
    const { items, subtotal } = priceCart([line], catalog)
    expect(items[0].unit).toBe(20000 + 2000 + 1500 + 3000)
    expect(subtotal).toBe(items[0].unit * 2)
    expect(items[0].patches).toEqual([{ group: 'Liga', name: 'Champions', price: 1500 }])
  })

  it('avisa si el precio cambió desde que se agregó', () => {
    const line = makeLine({ productId: 'p1', size: 'M', priceAt: 18000 })
    const result = priceCart([line], catalog)
    expect(result.items[0].changed).toBe(true)
    expect(result.hasChanges).toBe(true)
  })

  describe('con versiones', () => {
    const shirtWithVariants = {
      ...product,
      baseVariantName: 'Hombre',
      variants: [
        {
          id: 'mujer',
          name: 'Mujer',
          visible: true,
          price: 18000,
          sizes: ['S', 'M', 'L', 'XL'],
          patchGroupIds: [],
        },
        {
          id: 'nino',
          name: 'Niño',
          visible: true,
          price: 15000,
          sizes: ['16', '18'],
        },
        { id: 'oculta', name: 'Retro', visible: false, price: 30000 },
      ],
    }
    const variantCatalog = { ...catalog, products: [shirtWithVariants] }

    it('calcula con el precio y los parches de la versión', () => {
      const mujer = makeLine({ productId: 'p1', size: 'XL', variantId: 'mujer', qty: 2 })
      const nino = makeLine({
        productId: 'p1',
        size: '16',
        variantId: 'nino',
        patches: { g1: 0 },
      })
      const { items, subtotal } = priceCart([mujer, nino], variantCatalog)
      // Mujer: 18000 + recargo XL de la camisa (2000), sin parches. Niño hereda parches y no paga recargo.
      expect(items[0].unit).toBe(18000 + 2000)
      expect(items[0].variantName).toBe('Mujer')
      expect(items[0].patches).toEqual([])
      expect(items[1].unit).toBe(15000 + 1500)
      expect(items[1].variantName).toBe('Niño')
      expect(subtotal).toBe(items[0].total + items[1].total)
    })

    it('la versión base no muestra nombre de versión y usa el precio de la camisa', () => {
      const { items } = priceCart([makeLine({ productId: 'p1', size: 'M' })], variantCatalog)
      expect(items[0].status).toBe('ok')
      expect(items[0].variantName).toBeNull()
      expect(items[0].unit).toBe(20000)
    })

    it('marca no disponible una versión oculta o inexistente y no la cobra', () => {
      const hidden = makeLine({ productId: 'p1', size: 'M', variantId: 'oculta' })
      const missing = makeLine({ productId: 'p1', size: 'M', variantId: 'borrada' })
      const ok = makeLine({ productId: 'p1', size: 'M', variantId: 'mujer' })
      const result = priceCart([hidden, missing, ok], variantCatalog)
      expect(result.items[0].status).toBe('unavailable')
      expect(result.items[1].status).toBe('unavailable')
      expect(result.items[2].status).toBe('ok')
      expect(result.hasUnavailable).toBe(true)
      expect(result.subtotal).toBe(18000)
    })

    it('marca no disponible una talla que la versión no ofrece', () => {
      const line = makeLine({ productId: 'p1', size: '3XL', variantId: 'mujer' })
      expect(priceCart([line], variantCatalog).items[0].status).toBe('unavailable')
    })

    it('una línea vieja sin variantId sigue funcionando en una camisa que ahora tiene versiones', () => {
      const old = sanitizeLines([{ productId: 'p1', size: 'XL', qty: 1, priceAt: 22000 }])
      const { items } = priceCart(old, variantCatalog)
      expect(items[0].status).toBe('ok')
      expect(items[0].unit).toBe(22000)
      expect(items[0].changed).toBe(false)
    })
  })

  it('marca como no disponible lo que salió del catálogo y no lo cobra', () => {
    const gone = makeLine({ productId: 'borrada', size: 'M', qty: 3 })
    const ok = makeLine({ productId: 'p1', size: 'M' })
    const result = priceCart([gone, ok], catalog)
    expect(result.items[0].status).toBe('unavailable')
    expect(result.hasUnavailable).toBe(true)
    expect(result.subtotal).toBe(20000)
  })
})
