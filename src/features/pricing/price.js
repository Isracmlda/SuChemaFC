import { SIZES } from '../../utils/constants.js'
import { effectivePrice } from '../catalog/salePrice.js'
import { resolveVariant, variantSizes } from '../catalog/variants.js'

/**
 * Recargos estándar de la tienda (`settings/sizeSurcharges`): `{ sizes: { [talla]: CRC },
 * personalization: CRC }`. Cada camisa puede sobrescribirlos.
 */

/**
 * Recargo de una talla, buscado por nombre: versión → camisa → estándar → 0 (un 0 propio gana).
 * Sin `variantId` (o si `product` ya es la vista de una versión) usa `product.sizeSurcharges`.
 * Con `variantId` de una versión inexistente u oculta no hay recargo (la línea no está disponible).
 */
export function sizeSurcharge(product, size, standard = {}, variantId = null) {
  const source = variantId ? resolveVariant(product, variantId) : product
  if (!source) return 0
  return source.sizeSurcharges?.[size] ?? standard?.sizes?.[size] ?? 0
}

/** Recargo por nombre y número: el de la camisa si lo definió (aunque sea 0) y, si no, el estándar. */
export function personalizationSurcharge(product, standard = {}) {
  return product.personalization?.surcharge ?? standard?.personalization ?? 0
}

/**
 * Precio unitario de una línea: base vigente + recargo de talla + parche elegido + personalización.
 * selection: { size, patches: { [groupId]: optionIndex | null }, personalized }
 * `standard`: recargos estándar de la tienda (ver arriba).
 * El descuento por cupón se aplica aparte (subtarea 8).
 */
export function unitPrice(product, patchGroups, selection, now = Date.now(), standard = {}) {
  let total = effectivePrice(product, now)
  if (selection.size) total += sizeSurcharge(product, selection.size, standard)

  for (const group of patchGroups) {
    const index = selection.patches?.[group.id]
    if (index != null && group.options[index]) total += group.options[index].price
  }

  if (selection.personalized && product.personalization?.enabled) {
    total += personalizationSurcharge(product, standard)
  }
  return total
}

/**
 * ¿Es una talla ofrecida? Sin `product` valida contra las estándar (`SIZES`); con `product` valida
 * contra las tallas visibles de la versión (`variantId`, o la base si falta).
 */
export const isValidSize = (size, product, variantId = null) =>
  (product ? variantSizes(product, variantId) : SIZES).includes(size)
