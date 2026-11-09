import { normalizeText } from '../../../utils/format.js'

export const RECENT_LIMIT = 10

/**
 * Grupos de parches a mostrar. `mode`: 'recientes' (los últimos 10 agregados; con búsqueda se
 * busca en todos), 'elegidos' (los de `selectedIds`) o 'todos'. `query` filtra por el nombre del
 * grupo o de sus opciones. El orden es siempre del más nuevo al más antiguo.
 */
export function filterPatchGroups(
  groups,
  { query = '', mode = 'recientes', selectedIds = [] } = {},
) {
  const newest = [...groups].sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
  const q = normalizeText(query)
  let pool = newest
  if (mode === 'elegidos') pool = newest.filter((g) => selectedIds.includes(g.id))
  else if (mode === 'recientes' && !q) pool = newest.slice(0, RECENT_LIMIT)
  if (!q) return pool
  return pool.filter((g) =>
    normalizeText([g.name, ...(g.options ?? []).map((o) => o.name)].join(' ')).includes(q),
  )
}
