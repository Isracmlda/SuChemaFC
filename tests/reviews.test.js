import { describe, expect, it } from 'vitest'
import {
  MAX_REVIEW_PHOTOS,
  MAX_REVIEW_TEXT,
  buildReview,
  ratingBreakdown,
  ratingSummary,
  reviewId,
  sortReviews,
  validateReview,
} from '../src/features/reviews/reviews.js'

const ok = { rating: 5, text: 'Muy buena', photos: [], authorName: 'Ana' }

describe('reseñas', () => {
  it('el ID es producto_uid (una reseña por usuario y producto)', () => {
    expect(reviewId('p1', 'u1')).toBe('p1_u1')
  })

  it('valida calificación, texto, fotos y nombre', () => {
    expect(validateReview(ok).valid).toBe(true)
    expect(validateReview({ ...ok, rating: 0 }).errors.rating).toBeDefined()
    expect(validateReview({ ...ok, rating: 6 }).errors.rating).toBeDefined()
    expect(validateReview({ ...ok, rating: 4.5 }).errors.rating).toBeDefined()
    expect(validateReview({ ...ok, text: '   ' }).errors.text).toBeDefined()
    expect(validateReview({ ...ok, text: 'x'.repeat(MAX_REVIEW_TEXT) }).valid).toBe(true)
    expect(
      validateReview({ ...ok, text: 'x'.repeat(MAX_REVIEW_TEXT + 1) }).errors.text,
    ).toBeDefined()
    const photos = Array.from({ length: MAX_REVIEW_PHOTOS + 1 }, (_, i) => `f${i}`)
    expect(validateReview({ ...ok, photos }).errors.photos).toBeDefined()
    expect(validateReview({ ...ok, authorName: '' }).errors.author).toBeDefined()
  })

  it('arma el documento sin aprobar, con el texto recortado', () => {
    const doc = buildReview({ ...ok, productId: 'p1', uid: 'u1', text: '  hola  ' })
    expect(doc).toEqual({
      productId: 'p1',
      uid: 'u1',
      authorName: 'Ana',
      rating: 5,
      text: 'hola',
      photos: [],
      approved: false,
    })
  })

  it('calcula promedio, desglose y orden', () => {
    expect(ratingSummary([])).toEqual({ average: 0, count: 0 })
    const list = [
      { rating: 5, createdAt: 1 },
      { rating: 4, createdAt: 3 },
      { rating: 4, createdAt: 2 },
    ]
    expect(ratingSummary(list)).toEqual({ average: 4.3, count: 3 })
    expect(ratingBreakdown(list)).toEqual({ 5: 1, 4: 2, 3: 0, 2: 0, 1: 0 })
    expect(sortReviews(list).map((r) => r.createdAt)).toEqual([3, 2, 1])
    expect(list[0].createdAt).toBe(1)
  })
})
