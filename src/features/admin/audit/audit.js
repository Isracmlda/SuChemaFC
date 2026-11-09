import { toMillis } from '../../../utils/dates.js'

/** Filtros del visor de bitácora (se aplican en el cliente sobre las entradas ya leídas). */

export const AUDIT_ACTIONS = ['crear', 'editar', 'eliminar', 'guardar', 'reordenar']

export const ACTION_LABEL = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  guardar: 'Guardar',
  reordenar: 'Reordenar',
}

/** Valores distintos de un campo, ordenados (para llenar los filtros). */
export const distinct = (entries, key) =>
  [...new Set(entries.map((e) => e[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/** Filtra por acción, colección, texto (resumen, ID o admin) y rango de fechas en milisegundos. */
export function filterAudit(
  entries,
  { action = '', collection = '', query = '', from = null, to = null } = {},
) {
  const q = query.trim().toLowerCase()
  return entries.filter((e) => {
    if (action && e.action !== action) return false
    if (collection && e.collection !== collection) return false
    const at = toMillis(e.createdAt)
    if (from != null && (at == null || at < from)) return false
    if (to != null && (at == null || at > to)) return false
    if (!q) return true
    return [e.summary, e.docId, e.actorUid, e.collection].join(' ').toLowerCase().includes(q)
  })
}

/** Fin del día local (23:59:59.999) de un valor `YYYY-MM-DD`, o null. */
export function endOfDay(dateText) {
  if (!dateText) return null
  const ms = new Date(`${dateText}T23:59:59.999`).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** Inicio del día local de un valor `YYYY-MM-DD`, o null. */
export function startOfDay(dateText) {
  if (!dateText) return null
  const ms = new Date(`${dateText}T00:00:00`).getTime()
  return Number.isFinite(ms) ? ms : null
}
