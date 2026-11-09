/** Milisegundos desde un Timestamp de Firestore, un número o null. */
export const toMillis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : (v ?? null))

const pad = (n) => String(n).padStart(2, '0')

/** Valor para <input type="datetime-local"> (hora local) a partir de milisegundos. */
export function toInputValue(ms) {
  if (ms == null) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Milisegundos desde el valor de un <input type="datetime-local">, o null si está vacío o es inválido. */
export function fromInputValue(text) {
  if (!text) return null
  const ms = new Date(text).getTime()
  return Number.isFinite(ms) ? ms : null
}

const DATE_TIME = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDateTime = (ms) => (ms == null ? '' : DATE_TIME.format(ms))
