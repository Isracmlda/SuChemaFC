/**
 * Borradores del formulario de camisa, guardados en el navegador (localStorage) para no perder lo
 * escrito al salir de la página o si no se alcanza a terminar. Lógica pura salvo por el `storage`,
 * que se puede inyectar en las pruebas.
 */

const PREFIX = 'suchema:productDraft:'
const NEW_ID = 'new'

/** Campos editables de la camisa que viajan en el borrador (sin fechas ni ofertas de Firestore). */
export const DRAFT_FIELDS = [
  'name',
  'description',
  'price',
  'baseVariantName',
  'sizes',
  'sizeChartId',
  'variants',
  'sectionIds',
  'tagIds',
  'images',
  'patchGroupIds',
  'disabledPatches',
  'competitionIds',
  'sizeSurcharges',
  'personalization',
  'visible',
]

// Si faltan en el borrador es porque estaban sin definir (JSON omite `undefined`).
const OPTIONAL_FIELDS = new Set(['sizes', 'sizeChartId'])

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const draftKey = (productId) => `${PREFIX}${productId || NEW_ID}`

/** Solo los campos editables; las ofertas de las versiones no se guardan (son Timestamps). */
export function toDraftProduct(product) {
  const out = {}
  for (const field of DRAFT_FIELDS) {
    if (product?.[field] === undefined) continue
    out[field] =
      field === 'variants' && Array.isArray(product.variants)
        ? product.variants.map((variant) => {
            const copy = { ...variant }
            delete copy.sale
            return copy
          })
        : product[field]
  }
  return out
}

/** Camisa cargada (`base`) con los campos editables del borrador encima; devuelve las ofertas de las versiones. */
export function fromDraftProduct(base, draft) {
  const next = { ...base }
  for (const field of DRAFT_FIELDS) {
    if (field in draft) next[field] = draft[field]
    else if (OPTIONAL_FIELDS.has(field)) next[field] = undefined
  }
  if (Array.isArray(draft.variants)) {
    next.variants = draft.variants.map((variant) => {
      const sale = base.variants?.find((v) => v.id === variant.id)?.sale
      return sale ? { ...variant, sale } : variant
    })
  }
  return next
}

/** Lo que se guarda: la camisa editable, costos y hashtags nuevos aún no creados. */
export function buildDraft({ product, cost, variantCosts, pendingTags }) {
  return {
    product: toDraftProduct(product),
    cost: cost ?? 0,
    variantCosts: variantCosts ?? {},
    pendingTags: pendingTags ?? [],
  }
}

/** Texto estable para saber si el borrador difiere de lo guardado en Firestore. */
export const draftSignature = (draft) => JSON.stringify(draft)

export function loadDraft(productId, storage = defaultStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(draftKey(productId)) ?? 'null')
    if (!parsed || typeof parsed.draft?.product !== 'object' || parsed.draft.product === null) {
      return null
    }
    return { draft: parsed.draft, savedAt: Number(parsed.savedAt) || 0 }
  } catch {
    return null
  }
}

export function saveDraft(productId, draft, now = Date.now(), storage = defaultStorage()) {
  try {
    storage?.setItem(draftKey(productId), JSON.stringify({ draft, savedAt: now }))
    return true
  } catch {
    return false // sin espacio o sin localStorage: el borrador es opcional
  }
}

export function clearDraft(productId, storage = defaultStorage()) {
  try {
    storage?.removeItem(draftKey(productId))
  } catch {
    // sin localStorage: nada que borrar
  }
}

/** Borradores guardados: `[{ productId (null = camisa nueva), name, savedAt }]`, el más reciente primero. */
export function listDrafts(storage = defaultStorage()) {
  const found = []
  try {
    for (let i = 0; i < (storage?.length ?? 0); i += 1) {
      const key = storage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const id = key.slice(PREFIX.length)
      const productId = id === NEW_ID ? null : id
      const saved = loadDraft(productId, storage)
      if (saved) {
        found.push({ productId, name: saved.draft.product.name ?? '', savedAt: saved.savedAt })
      }
    }
  } catch {
    return []
  }
  return found.sort((a, b) => b.savedAt - a.savedAt)
}
