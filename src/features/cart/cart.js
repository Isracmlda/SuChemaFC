import { isOptionDisabled } from '../catalog/patches.js'
import { resolveVariant } from '../catalog/variants.js'
import { isValidSize, unitPrice } from '../pricing/price.js'

export const MAX_LINES = 50 // igual que el límite de las reglas de Firestore (users.cart)
export const MAX_QTY = 10
export const MAX_WISHLIST = 200 // igual que el límite de las reglas (users.wishlist)

/** Solo parches elegidos (índice entero), ordenados por grupo para que la llave sea estable. */
export function normalizePatches(patches = {}) {
  return Object.fromEntries(
    Object.entries(patches ?? {})
      .filter(([, index]) => Number.isInteger(index))
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

/**
 * { name, number, competition? } o null si no hay nada que personalizar.
 * `competition` es el nombre de la competición elegida (de ella depende el estilo del estampado).
 */
export function normalizeCustom(custom) {
  if (!custom) return null
  const name = String(custom.name ?? '')
  const number = String(custom.number ?? '')
  const competition = String(custom.competition ?? '')
  if (!name && !number) return null
  return competition ? { name, number, competition } : { name, number }
}

/** Id de versión válido (texto no vacío) o '' si la línea es de la versión base. */
const normalizeVariantId = (variantId) =>
  typeof variantId === 'string' && variantId ? variantId : ''

/**
 * Dos líneas con la misma llave son la misma compra y se suman en cantidad. La versión se agrega al
 * final solo si existe, para que la llave de las líneas sin `variantId` (versión base) no cambie.
 */
export function lineKey({ productId, size, patches, custom, variantId }) {
  const patchPart = Object.entries(normalizePatches(patches))
    .map(([group, index]) => `${group}:${index}`)
    .join(',')
  const c = normalizeCustom(custom)
  const variant = normalizeVariantId(variantId)
  return [
    productId,
    size,
    patchPart,
    c ? `${c.name}#${c.number}${c.competition ? `@${c.competition}` : ''}` : '',
    ...(variant ? [`v:${variant}`] : []),
  ].join('|')
}

const clampQty = (qty) => Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(qty)) || 1))

/**
 * Línea normalizada. `priceAt` es el precio unitario que vio el cliente al agregarla.
 * `variantId` es opcional: sin él la línea es de la versión base y no lleva esa clave.
 */
export function makeLine({ productId, size, patches, custom, qty = 1, priceAt = null, variantId }) {
  const variant = normalizeVariantId(variantId)
  const line = {
    productId,
    size,
    ...(variant ? { variantId: variant } : {}),
    patches: normalizePatches(patches),
    custom: normalizeCustom(custom),
    qty: clampQty(qty),
    priceAt: Number.isFinite(priceAt) ? priceAt : null,
  }
  return { key: lineKey(line), ...line }
}

/** Limpia lo que viene de localStorage o Firestore; descarta lo que no tenga forma de línea. */
export function sanitizeLines(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const lines = []
  for (const item of raw) {
    if (!item || typeof item.productId !== 'string' || typeof item.size !== 'string') continue
    const line = makeLine(item)
    if (seen.has(line.key)) continue
    seen.add(line.key)
    lines.push(line)
  }
  return lines.slice(0, MAX_LINES)
}

export function sanitizeIds(raw) {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((id) => typeof id === 'string' && id))].slice(0, MAX_WISHLIST)
}

export const cartCount = (lines) => lines.reduce((sum, l) => sum + l.qty, 0)

/** false si la línea sería nueva y el carrito ya está lleno. */
export const canAddLine = (lines, line) =>
  lines.length < MAX_LINES || lines.some((l) => l.key === line.key)

export function addLine(lines, line) {
  if (!canAddLine(lines, line)) return lines
  const existing = lines.find((l) => l.key === line.key)
  if (!existing) return [...lines, line]
  return lines.map((l) =>
    l.key === line.key ? { ...l, qty: clampQty(l.qty + line.qty), priceAt: line.priceAt } : l,
  )
}

export const setLineQty = (lines, key, qty) =>
  lines.map((l) => (l.key === key ? { ...l, qty: clampQty(qty) } : l))

export const removeLine = (lines, key) => lines.filter((l) => l.key !== key)

/** Guarda en cada línea el precio actual, tras aceptar el aviso de cambio de precio. */
export const acknowledgePrices = (lines, units) =>
  lines.map((l) => (l.key in units ? { ...l, priceAt: units[l.key] } : l))

/**
 * Une dos carritos. Si la misma línea está en ambos se queda la mayor cantidad (no la suma),
 * porque el carrito local suele ser copia del remoto y sumar lo duplicaría en cada inicio de sesión.
 */
export function mergeLines(a, b) {
  const map = new Map(a.map((l) => [l.key, l]))
  for (const line of b) {
    const current = map.get(line.key)
    if (!current) map.set(line.key, line)
    else if (line.qty > current.qty) map.set(line.key, { ...current, qty: line.qty })
  }
  return [...map.values()].slice(0, MAX_LINES)
}

export const mergeIds = (a, b) => [...new Set([...a, ...b])].slice(0, MAX_WISHLIST)

export const toggleId = (ids, id) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, MAX_WISHLIST)

/**
 * Calcula cada línea contra el catálogo actual. Los precios nunca se guardan: se recalculan aquí.
 * status: 'ok' o 'unavailable' (la camisa ya no existe, está oculta o eliminada, o su versión ya no
 * existe, está oculta o ya no ofrece esa talla).
 * `variantName` es el nombre de la versión elegida (null en la versión base, que no se muestra).
 * `changed` es true si el precio de hoy difiere del que vio el cliente al agregar.
 */
export function priceCart(lines, catalog, now = Date.now()) {
  const items = lines.map((line) => {
    const product = catalog.products.find((p) => p.id === line.productId)
    if (!product) return { line, product: null, status: 'unavailable', unit: 0, total: 0 }

    const view = resolveVariant(product, line.variantId)
    if (!view || !isValidSize(line.size, product, line.variantId)) {
      return { line, product, status: 'unavailable', unit: 0, total: 0, variantName: null }
    }

    const groups = (view.patchGroupIds ?? [])
      .map((id) => catalog.patchGroups.find((g) => g.id === id))
      .filter(Boolean)
    // Un parche que la camisa ya no ofrece deja la línea no disponible.
    const offeredPatches = groups.every((g) => {
      const option = g.options[line.patches[g.id]]
      return !option || !isOptionDisabled(view, g.id, option)
    })
    if (!offeredPatches) {
      return { line, product, status: 'unavailable', unit: 0, total: 0, variantName: null }
    }
    const unit = unitPrice(
      view,
      groups,
      { size: line.size, patches: line.patches, personalized: Boolean(line.custom) },
      now,
      catalog.surcharges,
    )
    const patches = groups.flatMap((g) => {
      const option = g.options[line.patches[g.id]]
      return option ? [{ group: g.name, name: option.name, price: option.price }] : []
    })
    return {
      line,
      product,
      variantName: line.variantId ? view.variantName : null,
      status: 'ok',
      unit,
      total: unit * line.qty,
      patches,
      changed: line.priceAt != null && line.priceAt !== unit,
    }
  })
  const available = items.filter((i) => i.status === 'ok')
  return {
    items,
    subtotal: available.reduce((sum, i) => sum + i.total, 0),
    hasChanges: available.some((i) => i.changed),
    hasUnavailable: items.some((i) => i.status === 'unavailable'),
  }
}
