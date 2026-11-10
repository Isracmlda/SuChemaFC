/**
 * Opciones de parches activas por camisa. Lógica pura: sin React ni Firestore.
 *
 * `product.disabledPatches`: `{ [groupId]: [nombreDeOpción, ...] }` con las opciones del grupo que esa
 * camisa NO ofrece. Se identifican por nombre (no por índice) para que quitar u ordenar opciones del
 * grupo no desactive otra por error. Sin dato, todas las opciones están activas. Las versiones heredan
 * la lista de la camisa base.
 */

const optionKey = (option) => String(option?.name ?? '').trim()

/** true si la camisa tiene desactivada esa opción del grupo. */
export function isOptionDisabled(product, groupId, option) {
  const off = product?.disabledPatches?.[groupId]
  return Array.isArray(off) && off.includes(optionKey(option))
}

/** Opciones activas de un grupo para una camisa, conservando su índice original (el carrito lo usa). */
export function enabledOptions(product, group) {
  return (group?.options ?? [])
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !isOptionDisabled(product, group.id, option))
}

/** Pasa a activar/desactivar una opción; devuelve un `disabledPatches` nuevo sin listas vacías. */
export function setOptionEnabled(disabledPatches, groupId, option, enabled) {
  const key = optionKey(option)
  const current = disabledPatches?.[groupId] ?? []
  const nextList = enabled ? current.filter((n) => n !== key) : [...new Set([...current, key])]
  const { [groupId]: _old, ...rest } = disabledPatches ?? {}
  return nextList.length > 0 ? { ...rest, [groupId]: nextList } : rest
}

/** Grupos de parches que usa la camisa: los de la base y los de sus versiones con parches propios. */
export function usedPatchGroupIds(product) {
  return [
    ...new Set([
      ...(product?.patchGroupIds ?? []),
      ...(product?.variants ?? []).flatMap((v) => v?.patchGroupIds ?? []),
    ]),
  ]
}

/** Limpia para guardar: solo grupos usados por la camisa y nombres no vacíos. Puede devolver `{}`. */
export function cleanDisabledPatches(disabledPatches, groupIds = []) {
  const allowed = new Set(groupIds)
  const result = {}
  for (const [groupId, names] of Object.entries(disabledPatches ?? {})) {
    if (!allowed.has(groupId) || !Array.isArray(names)) continue
    const clean = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))]
    if (clean.length > 0) result[groupId] = clean
  }
  return result
}
