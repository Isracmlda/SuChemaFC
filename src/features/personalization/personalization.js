export const NAME_MAX = 12
export const NUMBER_MAX = 99

/** Mayúsculas y solo letras, espacios, punto, apóstrofo y guion. Recorta al máximo permitido. */
export function sanitizeName(value = '') {
  return String(value)
    .toUpperCase()
    .replace(/[^A-ZÑÁÉÍÓÚÜ .'-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, NAME_MAX)
}

/** Solo dígitos, máximo dos. */
export function sanitizeNumber(value = '') {
  return String(value).replace(/\D/g, '').slice(0, 2)
}

/**
 * Valida la personalización. Si no se pide personalizar, siempre es válida.
 * Debe llevar al menos nombre o número y, si la camisa ofrece competiciones
 * (`requireCompetition`), haber elegido una.
 */
export function validatePersonalization(
  { enabled, name, number, competition = '' },
  { requireCompetition = false } = {},
) {
  if (!enabled) return { valid: true, errors: {} }
  const errors = {}
  const cleanName = sanitizeName(name).trim()
  const cleanNumber = sanitizeNumber(number)

  if (!cleanName && !cleanNumber) errors.general = 'Escribe un nombre, un número o ambos.'
  if (cleanName.length > NAME_MAX) errors.name = `Máximo ${NAME_MAX} caracteres.`
  if (cleanNumber && Number(cleanNumber) > NUMBER_MAX) errors.number = `Entre 0 y ${NUMBER_MAX}.`
  if (requireCompetition && !competition) errors.competition = 'Elige la competición.'
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Datos listos para guardar en la línea del carrito, o null si no se personaliza.
 * `competition` (nombre de la competición) solo se incluye si se eligió una.
 */
export function personalizationValue({ enabled, name, number, competition = '' }) {
  if (!enabled) return null
  const value = { name: sanitizeName(name).trim(), number: sanitizeNumber(number) }
  return competition ? { ...value, competition } : value
}

/** Texto de la personalización para pedidos, recibos y mensajes: "MESSI 10 (Champions)". */
export function describeCustom(custom) {
  if (!custom) return ''
  const text = [custom.name, custom.number].filter(Boolean).join(' ')
  return custom.competition ? `${text} (${custom.competition})` : text
}

/** Tamaño de letra (en unidades del SVG de la vista previa) según el largo del nombre. */
export function previewNameSize(name) {
  const len = Math.max(name.length, 1)
  return Math.min(18, Math.max(9, 150 / len))
}
