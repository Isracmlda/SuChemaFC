import { describe, expect, it } from 'vitest'
import {
  buildDraft,
  clearDraft,
  draftSignature,
  fromDraftProduct,
  listDrafts,
  loadDraft,
  saveDraft,
  toDraftProduct,
} from '../src/features/admin/catalog/draft.js'
import { priceCart } from '../src/features/cart/cart.js'
import {
  cleanDisabledPatches,
  enabledOptions,
  isOptionDisabled,
  setOptionEnabled,
  usedPatchGroupIds,
} from '../src/features/catalog/patches.js'

const group = {
  id: 'g1',
  name: 'Liga',
  options: [
    { name: 'A', price: 100 },
    { name: 'B', price: 200 },
    { name: 'C', price: 300 },
  ],
}

function fakeStorage() {
  const data = new Map()
  return {
    get length() {
      return data.size
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

describe('parches activos por camisa', () => {
  it('sin dato todas las opciones están activas', () => {
    expect(enabledOptions({}, group).map((e) => e.index)).toEqual([0, 1, 2])
  })

  it('una opción desactivada se oculta pero conserva el índice original de las demás', () => {
    const product = { disabledPatches: { g1: ['B'] } }
    expect(isOptionDisabled(product, 'g1', group.options[1])).toBe(true)
    expect(enabledOptions(product, group).map((e) => e.index)).toEqual([0, 2])
  })

  it('setOptionEnabled activa y desactiva sin dejar listas vacías', () => {
    const off = setOptionEnabled({}, 'g1', group.options[0], false)
    expect(off).toEqual({ g1: ['A'] })
    expect(setOptionEnabled(off, 'g1', group.options[0], true)).toEqual({})
  })

  it('cleanDisabledPatches descarta grupos no usados y nombres vacíos', () => {
    expect(cleanDisabledPatches({ g1: ['A', ' ', 'A'], g2: ['X'] }, ['g1'])).toEqual({ g1: ['A'] })
  })

  it('usedPatchGroupIds une los de la base y los de las versiones', () => {
    const product = { patchGroupIds: ['g1'], variants: [{ patchGroupIds: ['g2', 'g1'] }, {}] }
    expect(usedPatchGroupIds(product)).toEqual(['g1', 'g2'])
  })

  it('el carrito marca no disponible una línea con un parche que se desactivó', () => {
    const product = {
      id: 'p1',
      price: 1000,
      visible: true,
      patchGroupIds: ['g1'],
      disabledPatches: { g1: ['B'] },
      sizes: ['M'],
    }
    const catalog = { products: [product], patchGroups: [group], surcharges: {} }
    const ok = priceCart([{ productId: 'p1', size: 'M', patches: { g1: 0 }, qty: 1 }], catalog)
    const off = priceCart([{ productId: 'p1', size: 'M', patches: { g1: 1 }, qty: 1 }], catalog)
    expect(ok.items[0].status).toBe('ok')
    expect(off.items[0].status).toBe('unavailable')
  })
})

describe('borradores de camisa', () => {
  const product = {
    name: 'Camisa',
    description: '',
    price: 1000,
    sectionIds: ['s1'],
    tagIds: [],
    images: [],
    patchGroupIds: [],
    variants: [{ id: 'v1', name: 'Mujer', sale: { percent: 10 } }],
    visible: true,
    createdAt: 123,
  }

  it('el borrador no guarda fechas ni ofertas de versiones', () => {
    const draft = toDraftProduct(product)
    expect(draft.createdAt).toBeUndefined()
    expect(draft.variants[0].sale).toBeUndefined()
  })

  it('al recuperar se conservan las ofertas actuales de las versiones', () => {
    const draft = toDraftProduct({ ...product, name: 'Editada' })
    const next = fromDraftProduct(product, draft)
    expect(next.name).toBe('Editada')
    expect(next.createdAt).toBe(123)
    expect(next.variants[0].sale).toEqual({ percent: 10 })
  })

  it('guarda, carga, lista y borra', () => {
    const storage = fakeStorage()
    const draft = buildDraft({ product, cost: 5, variantCosts: {}, pendingTags: [] })
    expect(saveDraft(null, draft, 10, storage)).toBe(true)
    expect(saveDraft('p1', draft, 20, storage)).toBe(true)
    expect(loadDraft('p1', storage).savedAt).toBe(20)
    expect(listDrafts(storage).map((d) => d.productId)).toEqual(['p1', null])
    clearDraft('p1', storage)
    expect(loadDraft('p1', storage)).toBeNull()
  })

  it('un borrador dañado se ignora', () => {
    const storage = fakeStorage()
    storage.setItem('suchema:productDraft:new', '{no es json')
    expect(loadDraft(null, storage)).toBeNull()
  })

  it('la firma cambia solo cuando cambia algo', () => {
    const a = buildDraft({ product, cost: 5, variantCosts: {}, pendingTags: [] })
    const b = buildDraft({ product: { ...product }, cost: 5, variantCosts: {}, pendingTags: [] })
    const c = buildDraft({ product: { ...product, price: 2 }, cost: 5, variantCosts: {} })
    expect(draftSignature(a)).toBe(draftSignature(b))
    expect(draftSignature(a)).not.toBe(draftSignature(c))
  })
})
