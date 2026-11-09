import { normalizeText } from './format.js'

/** Niveles máximos de anidación: Liga › Equipo › Visita › Niño › Versión fan. */
export const MAX_SECTION_DEPTH = 5
export const SECTION_NAME_MAX = 80

/** Árbol de secciones a partir de la lista plana (parentId + order). */
export function buildTree(items, parentId = null) {
  return items
    .filter((i) => (i.parentId ?? null) === parentId)
    .sort((a, b) => a.order - b.order)
    .map((i) => ({ ...i, children: buildTree(items, i.id) }))
}

/** Lista plana en orden de árbol, con `depth` para indentar. */
export function flattenTree(tree, depth = 0) {
  return tree.flatMap((n) => [{ ...n, depth }, ...flattenTree(n.children, depth + 1)])
}

/**
 * Lista plana del árbol mostrando solo las ramas abiertas (`expanded` es un Set de ids).
 * Cada fila trae `depth` (0 = principal) y `hasChildren`.
 */
export function flattenVisible(tree, expanded, depth = 0) {
  return tree.flatMap((n) => [
    { ...n, depth, hasChildren: n.children.length > 0 },
    ...(expanded.has(n.id) ? flattenVisible(n.children, expanded, depth + 1) : []),
  ])
}

/** Siguiente valor de `order` para una lista de hermanos. */
export function nextOrder(list) {
  return list.length ? Math.max(...list.map((o) => o.order ?? 0)) + 1 : 0
}

/** Nivel de una sección (1 = principal). 0 si `id` es nulo o no existe. */
export function sectionDepth(sections, id) {
  const byId = new Map(sections.map((s) => [s.id, s]))
  let depth = 0
  let current = id ? byId.get(id) : null
  while (current && depth < 20) {
    depth += 1
    current = current.parentId ? byId.get(current.parentId) : null
  }
  return depth
}

/** Texto con el primer problema al crear una sección dentro de `parentId`, o '' si es válida. */
export function validateNewSection(sections, name, parentId = null) {
  const clean = String(name).trim()
  if (!clean) return 'Escribe el nombre de la sección.'
  if (clean.length > SECTION_NAME_MAX) {
    return `El nombre admite hasta ${SECTION_NAME_MAX} caracteres.`
  }
  if (parentId && !sections.some((s) => s.id === parentId)) {
    return 'La sección elegida ya no existe.'
  }
  if (sectionDepth(sections, parentId) >= MAX_SECTION_DEPTH) {
    return `Solo se admiten ${MAX_SECTION_DEPTH} niveles de secciones.`
  }
  const key = normalizeText(clean)
  const repeated = sections.some(
    (s) => (s.parentId ?? null) === (parentId || null) && normalizeText(s.name) === key,
  )
  return repeated ? `Ya existe "${clean}" en esa ubicación.` : ''
}
