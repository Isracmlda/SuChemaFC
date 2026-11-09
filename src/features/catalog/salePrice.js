/**
 * Oferta y precio vigente de un producto (o de la vista de una versión). Módulo puro y sin
 * dependencias: lo comparten `search.js` y `variants.js` sin crear ciclos de importación.
 */

/** true si el precio rebajado está vigente en el instante `now` (milisegundos). */
export function isSaleActive(product, now = Date.now()) {
  const s = product.sale
  if (!s || !Number.isFinite(s.price)) return false
  if (s.startsAt && now < s.startsAt) return false
  if (s.endsAt && now > s.endsAt) return false
  return s.price < product.price
}

/** Precio unitario base vigente (oferta si corresponde). */
export function effectivePrice(product, now = Date.now()) {
  return isSaleActive(product, now) ? product.sale.price : product.price
}
