import { slugify } from '../../../utils/format.js'

export const RECENT_TAGS = 10

const createdMs = (tag) => tag.createdAt?.toMillis?.() ?? (Number(tag.createdAt) || 0)

/** Palabra que se está escribiendo (la última), sin # ni separadores. */
export const typedToken = (text) =>
  String(text ?? '')
    .split(/[\s,]+/)
    .pop()
    .replace(/^#+/, '')

/**
 * Hashtags sugeridos (sin los ya elegidos). Sin texto: los últimos `RECENT_TAGS` creados (los nuevos
 * aún sin guardar, `pendingIds`, van primero; los guardados sin fecha cuentan como los más antiguos).
 * Con texto: todos los que coinciden con lo que se va escribiendo, alfabéticos.
 */
export function suggestTags(tags, { text = '', selectedIds = [], pendingIds = [] } = {}) {
  const query = slugify(typedToken(text))
  const free = tags.filter((t) => !selectedIds.includes(t.id))
  if (query) {
    return free
      .filter((t) => t.id.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  const rank = (t) => (pendingIds.includes(t.id) ? Infinity : createdMs(t))
  return free
    .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, 'es'))
    .slice(0, RECENT_TAGS)
}
