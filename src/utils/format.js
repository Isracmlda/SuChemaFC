const CRC = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
})

/** Formatea un monto entero en colones. */
export function formatCRC(amount) {
  return CRC.format(Number(amount) || 0)
}

/** Minúsculas, sin acentos y sin espacios sobrantes. Sirve para búsquedas, hashtags y alias. */
export function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Convierte lo que escribe el usuario a un entero no negativo (vacío = 0). */
export function toInt(value) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}
