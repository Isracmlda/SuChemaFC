/** Lógica pura de las reseñas: validación, ID, promedio y orden. */

export const MAX_REVIEW_TEXT = 1000
export const MAX_REVIEW_PHOTOS = 4

/** El ID obliga a una reseña por usuario y producto (lo exigen las reglas). */
export const reviewId = (productId, uid) => `${productId}_${uid}`

/**
 * Valida el formulario. Devuelve { valid, errors: { rating?, text?, photos?, author? } }.
 * `authorName` debe existir porque las reglas lo comparan con el nombre del token de Google.
 */
export function validateReview({ rating, text, photos, authorName }) {
  const errors = {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    errors.rating = 'Elige de 1 a 5 estrellas.'
  if (typeof text !== 'string' || text.trim().length === 0) errors.text = 'Escribe tu opinión.'
  else if (text.trim().length > MAX_REVIEW_TEXT) {
    errors.text = `Máximo ${MAX_REVIEW_TEXT} caracteres.`
  }
  if (!Array.isArray(photos) || photos.length > MAX_REVIEW_PHOTOS) {
    errors.photos = `Máximo ${MAX_REVIEW_PHOTOS} fotos.`
  }
  if (!authorName) errors.author = 'Tu cuenta de Google no tiene nombre. Revisa tu perfil.'
  return { valid: Object.keys(errors).length === 0, errors }
}

/** Documento a guardar (sin `createdAt`, que lo pone el servicio con la hora del servidor). */
export function buildReview({ productId, uid, authorName, rating, text, photos }) {
  return {
    productId,
    uid,
    authorName,
    rating,
    text: text.trim(),
    photos: [...photos],
    approved: false,
  }
}

/** { average, count } con el promedio a un decimal; 0 si no hay reseñas. */
export function ratingSummary(reviews) {
  const count = reviews.length
  if (count === 0) return { average: 0, count: 0 }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return { average: Math.round((sum / count) * 10) / 10, count }
}

const millis = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : Number(v) || 0)

/** Más recientes primero. No muta la lista. */
export const sortReviews = (reviews) =>
  [...reviews].sort((a, b) => millis(b.createdAt) - millis(a.createdAt))

/** Cantidad de reseñas por calificación: { 5: n, 4: n, ... 1: n }. */
export function ratingBreakdown(reviews) {
  const out = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const r of reviews) if (out[r.rating] !== undefined) out[r.rating] += 1
  return out
}
