import { normalizeText } from '../../utils/format.js'
import { effectivePrice, isSaleActive } from './salePrice.js'
import { minVariantPrice } from './variants.js'

// La lógica de oferta vive en `salePrice.js` (evita un ciclo con `variants.js`); se reexporta aquí.
export { effectivePrice, isSaleActive }

/** Ids de una sección y de todas sus descendientes. */
export function descendantIds(sections, id) {
  const result = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const s of sections) {
      if (s.parentId && result.has(s.parentId) && !result.has(s.id)) {
        result.add(s.id)
        grew = true
      }
    }
  }
  return result
}

/** Cadena de secciones desde la raíz hasta `id` (para migas de pan). */
export function sectionPath(sections, id) {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const path = []
  let current = byId.get(id)
  while (current && path.length < 10) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : null
  }
  return path
}

/**
 * Texto normalizado donde se busca: nombre, descripción, nombres de hashtags y sus alias.
 * Así "laliga" o "la liga" encuentran las camisas con ese hashtag aunque no lo digan en el nombre.
 */
export function buildHaystack(product, tagsById) {
  const tagText = (product.tagIds ?? [])
    .map((id) => tagsById.get(id))
    .filter(Boolean)
    .flatMap((t) => [t.name, ...(t.aliases ?? [])])
  return normalizeText([product.name, product.description, ...tagText].join(' '))
}

/**
 * Filtra camisas. filters: { query, sectionIds: Set|null, tagId, min, max }.
 * Todas las palabras de la búsqueda deben aparecer en el texto de la camisa. El rango de precio
 * usa el precio mínimo vigente entre la versión base y las versiones visibles.
 */
export function filterProducts(products, filters, tags, now = Date.now()) {
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const tokens = normalizeText(filters.query ?? '')
    .split(/\s+/)
    .filter(Boolean)

  return products.filter((p) => {
    if (filters.sectionIds && !p.sectionIds?.some((id) => filters.sectionIds.has(id))) return false
    if (filters.tagId && !p.tagIds?.includes(filters.tagId)) return false
    const price = minVariantPrice(p, now)
    if (filters.min && price < filters.min) return false
    if (filters.max && price > filters.max) return false
    if (tokens.length) {
      const haystack = buildHaystack(p, tagsById)
      if (!tokens.every((t) => haystack.includes(t))) return false
    }
    return true
  })
}

export const SORT_OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nombre', label: 'Nombre (A-Z)' },
]

export function sortProducts(products, order, now = Date.now()) {
  const list = [...products]
  switch (order) {
    case 'precio-asc':
      return list.sort((a, b) => minVariantPrice(a, now) - minVariantPrice(b, now))
    case 'precio-desc':
      return list.sort((a, b) => minVariantPrice(b, now) - minVariantPrice(a, now))
    case 'nombre':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    default:
      return list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }
}
