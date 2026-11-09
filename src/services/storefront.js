import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { toMillis } from '../utils/dates.js'
import { normalizeSale } from '../features/pricing/sale.js'
import { getDocData, listCollection } from './db.js'

const TTL_MS = 5 * 60 * 1000
let cache = null // { at, data }

/** Convierte los Timestamp de Firestore a milisegundos para que la lógica pura los compare. */
export function normalizeProduct(p) {
  return {
    ...p,
    createdAt: toMillis(p.createdAt),
    updatedAt: toMillis(p.updatedAt),
    sale: normalizeSale(p.sale),
    // Las ofertas de cada versión llevan las mismas fechas; sin `variants` el producto queda igual.
    ...(Array.isArray(p.variants)
      ? { variants: p.variants.map((v) => (v?.sale ? { ...v, sale: normalizeSale(v.sale) } : v)) }
      : {}),
  }
}

async function fetchCatalog() {
  // Las reglas exigen que el listado incluya exactamente estos filtros.
  const productsQuery = query(
    collection(db, 'products'),
    where('visible', '==', true),
    where('deleted', '==', false),
  )
  const [productsSnap, sections, tags, patchGroups, sizeCharts, competitions, standard] =
    await Promise.all([
      getDocs(productsQuery),
      listCollection('sections'),
      listCollection('tags'),
      listCollection('patchGroups'),
      listCollection('sizeCharts'),
      listCollection('competitions').catch(() => []),
      getDocData('settings', 'sizeSurcharges').catch(() => null),
    ])
  return {
    products: productsSnap.docs.map((d) => normalizeProduct({ id: d.id, ...d.data() })),
    sections: sections.filter((s) => s.visible).sort((a, b) => a.order - b.order),
    tags,
    patchGroups,
    sizeCharts: sizeCharts.sort((a, b) => a.order - b.order),
    competitions: competitions.sort((a, b) => a.order - b.order),
    surcharges: {
      sizes: standard?.values ?? {},
      personalization: standard?.personalization ?? 0,
    },
  }
}

/**
 * Catálogo público completo (camisas visibles, secciones visibles, hashtags y parches).
 * Se guarda en memoria unos minutos: la búsqueda y los filtros se hacen en el cliente,
 * así no se consulta Firestore en cada pulsación.
 */
export async function loadCatalog({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data
  const data = await fetchCatalog()
  cache = { at: Date.now(), data }
  return data
}

/** Una camisa visible por ID, o null si no existe, está oculta o eliminada. */
export async function loadProduct(id) {
  const catalog = await loadCatalog()
  const fromCache = catalog.products.find((p) => p.id === id)
  if (fromCache) return { product: fromCache, catalog }
  const direct = await getDocData('products', id).catch(() => null)
  const visible = direct && direct.visible && !direct.deleted
  return { product: visible ? normalizeProduct(direct) : null, catalog }
}

export function clearCatalogCache() {
  cache = null
}
