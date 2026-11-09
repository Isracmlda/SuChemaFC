import { addLine, makeLine } from '../cart/cart.js'
import {
  personalizationValue,
  validatePersonalization,
} from '../personalization/personalization.js'
import { isValidSize, unitPrice } from '../pricing/price.js'
import { hasVariants, resolveVariant, variantSizes } from './variants.js'

/**
 * Estado de cada "Camisa N" en la página de la camisa. Lógica pura: sin React ni Firestore.
 * Una camisa es `{ variantId, size, patches, custom }`; `variantId` null = versión base.
 */

export const blankCustom = () => ({ enabled: false, name: '', number: '', competition: '' })

export const blankShirt = () => ({ variantId: null, size: '', patches: {}, custom: blankCustom() })

/** Vista de la versión elegida; si ya no existe u está oculta, la de la versión base. */
export function shirtView(product, shirt) {
  return resolveVariant(product, shirt?.variantId) ?? resolveVariant(product, null)
}

/** Grupos de parches del catálogo que aplican a una vista (`patchGroupIds`), en su orden. */
export function patchGroupsFor(view, catalogGroups = []) {
  return (view?.patchGroupIds ?? [])
    .map((gid) => catalogGroups.find((g) => g.id === gid))
    .filter(Boolean)
}

/**
 * Cambia la versión de una camisa y limpia lo que ya no aplica: la talla si la nueva versión no la
 * ofrece, los parches de grupos que la versión no usa y la personalización si la versión no la permite.
 * Una versión inexistente u oculta no cambia nada.
 */
export function changeShirtVariant(shirt, product, variantId) {
  const view = resolveVariant(product, variantId)
  if (!view) return shirt
  const next = view.variantId ?? null
  if (next === (shirt.variantId ?? null)) return shirt

  const allowed = new Set(view.patchGroupIds ?? [])
  return {
    ...shirt,
    variantId: next,
    size: variantSizes(product, next).includes(shirt.size) ? shirt.size : '',
    patches: Object.fromEntries(Object.entries(shirt.patches).filter(([gid]) => allowed.has(gid))),
    custom: view.personalization?.enabled ? shirt.custom : blankCustom(),
  }
}

/** Texto del chip de cada camisa: "Camisa 2 · Niño · 16" (versión solo si la camisa tiene versiones). */
export function shirtChipLabel(product, shirt, index) {
  const parts = [`Camisa ${index + 1}`]
  if (hasVariants(product)) parts.push(shirtView(product, shirt).variantName)
  if (shirt.size) parts.push(shirt.size)
  return parts.join(' · ')
}

/** Precio y validez de una camisa con su versión, talla, parches y personalización. */
export function shirtInfo(
  product,
  shirt,
  { catalogGroups = [], requireCompetition = false, standard = {}, now = Date.now() } = {},
) {
  const view = shirtView(product, shirt)
  const personalizable = Boolean(view.personalization?.enabled)
  const valid =
    !personalizable || validatePersonalization(shirt.custom, { requireCompetition }).valid
  const personalized = personalizable && Boolean(shirt.custom.enabled) && valid
  const groups = patchGroupsFor(view, catalogGroups)
  const unit = unitPrice(
    view,
    groups,
    { size: shirt.size, patches: shirt.patches, personalized },
    now,
    standard,
  )
  return {
    view,
    groups,
    personalizable,
    valid,
    personalized,
    sizeOk: isValidSize(shirt.size, product, view.variantId),
    unit,
  }
}

/**
 * Resumen de la compra: info de cada camisa, total, si todas cuestan lo mismo, índices de las que
 * aún no tienen talla válida y si ya se puede agregar al carrito (todas con talla y personalización válida).
 */
export function summarizeShirts(product, shirts, options) {
  const infos = shirts.map((s) => shirtInfo(product, s, options))
  const unit = infos[0].unit
  const missingSize = infos.flatMap((info, i) => (info.sizeOk ? [] : [i]))
  return {
    infos,
    unit,
    sameUnit: infos.every((i) => i.unit === unit),
    total: infos.reduce((sum, i) => sum + i.unit, 0),
    missingSize,
    canAdd: missingSize.length === 0 && infos.every((i) => i.valid),
  }
}

/** Líneas de carrito (una por camisa, `variantId` solo si no es la base); las idénticas se juntan. */
export function buildShirtLines(product, shirts, infos) {
  return shirts
    .map((s, i) =>
      makeLine({
        productId: product.id,
        variantId: infos[i].view.variantId,
        size: s.size,
        patches: s.patches,
        custom: infos[i].personalized ? personalizationValue(s.custom) : null,
        qty: 1,
        priceAt: infos[i].unit,
      }),
    )
    .reduce((acc, line) => addLine(acc, line), [])
}
