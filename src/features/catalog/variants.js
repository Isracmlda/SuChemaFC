import { SIZES } from '../../utils/constants.js'
import { effectivePrice, isSaleActive } from './salePrice.js'

/**
 * Versiones (variantes) de una camisa. Lógica pura: sin React ni Firestore.
 *
 * `product.variants[]`: `{ id, name, visible, price?, images?, sizes?, sizeSurcharges?, patchGroupIds?,
 * personalization?, sizeChartId?, sale? }`. La versión base es la camisa misma (sin `variantId`); su
 * nombre es `product.baseVariantName` ("Estándar" si falta) y sus tallas visibles son `product.sizes`.
 */

export const DEFAULT_BASE_VARIANT_NAME = 'Estándar'

const hasId = (variantId) => variantId != null && variantId !== ''

/** Versiones que el cliente puede elegir (se ocultan solo con `visible: false`), en su orden. */
export function visibleVariants(product) {
  return (product?.variants ?? []).filter((v) => v?.id && v.visible !== false)
}

/** true si la camisa ofrece al menos una versión además de la base. */
export function hasVariants(product) {
  return visibleVariants(product).length > 0
}

/** Versión visible con ese id, o null (id vacío, inexistente u oculta). */
export function findVariant(product, variantId) {
  if (!hasId(variantId)) return null
  return visibleVariants(product).find((v) => v.id === variantId) ?? null
}

/**
 * Tallas que se ofrecen, en el orden en que se muestran. Sin `sizes` definidas son todas las estándar
 * (`SIZES`); las de una versión NO se heredan de la camisa. Una versión inexistente u oculta no ofrece
 * ninguna talla.
 */
export function variantSizes(product, variantId) {
  if (!hasId(variantId)) return nonEmpty(product?.sizes) ?? SIZES
  const variant = findVariant(product, variantId)
  if (!variant) return []
  return nonEmpty(variant.sizes) ?? SIZES
}

/**
 * "Vista" de la camisa para una versión, con la forma de un producto para reutilizar `unitPrice`,
 * `effectivePrice`, etc. Lo que la versión no define lo toma de la camisa base, salvo la oferta (`sale`):
 * la de la base aplica solo a la versión base y cada versión usa únicamente la suya.
 * Sin `variantId` devuelve la vista de la versión base. Devuelve null si la versión no existe u está oculta.
 * Campos vacíos que heredan: `images` y `sizes` (listas vacías); el resto hereda solo si es null/undefined.
 */
export function resolveVariant(product, variantId) {
  if (!product) return null
  const { variants: _variants, ...base } = product
  if (!hasId(variantId)) {
    return {
      ...base,
      variantId: null,
      variantName: product.baseVariantName || DEFAULT_BASE_VARIANT_NAME,
      sizes: variantSizes(product, null),
    }
  }

  const variant = findVariant(product, variantId)
  if (!variant) return null

  const personalization =
    variant.personalization != null
      ? { ...base.personalization, ...variant.personalization }
      : base.personalization
  const view = {
    ...base,
    variantId: variant.id,
    variantName: variant.name,
    price: variant.price ?? base.price,
    images: nonEmpty(variant.images) ?? base.images,
    sizes: variantSizes(product, variantId),
    sizeSurcharges: { ...base.sizeSurcharges, ...variant.sizeSurcharges },
    patchGroupIds: variant.patchGroupIds ?? base.patchGroupIds,
    personalization,
    sizeChartId: variant.sizeChartId ?? base.sizeChartId,
  }
  if (variant.sale != null) view.sale = variant.sale
  else delete view.sale
  return view
}

/**
 * Resumen de precios para listados: `min` (precio vigente más bajo entre la base y las versiones
 * visibles), `from` (true si los precios vigentes difieren, es decir, se muestra "desde") y `onSale`
 * (true si la base o alguna versión visible tiene oferta vigente).
 */
export function priceSummary(product, now = Date.now()) {
  const views = [
    resolveVariant(product, null),
    ...visibleVariants(product).map((v) => resolveVariant(product, v.id)),
  ].filter(Boolean)
  const prices = views.map((view) => effectivePrice(view, now))
  const min = Math.min(...prices)
  return {
    min,
    from: prices.some((p) => p !== min),
    onSale: views.some((view) => isSaleActive(view, now)),
  }
}

/** Precio vigente más bajo entre la versión base y las visibles (para "desde ₡X"). */
export const minVariantPrice = (product, now = Date.now()) => priceSummary(product, now).min

function nonEmpty(list) {
  return Array.isArray(list) && list.length ? list : null
}
