import { describe, expect, it } from 'vitest'
import {
  RECEIPT_WIDTH,
  qrModulePx,
  wrapLines,
} from '../src/features/admin/receipts/receiptImage.js'

// Medida simulada: cada letra mide 10 px.
const measure = (s) => s.length * 10

describe('recibo como imagen para impresora de 57 mm', () => {
  it('usa los 384 puntos de una impresora térmica de 58 mm', () => {
    expect(RECEIPT_WIDTH).toBe(384)
  })

  it('el QR del pedido usa cuadros enteros y mide un tercio menos que el ancho útil', () => {
    // «SCFC:» + ID de 20 caracteres → versión 2 (25 cuadros)
    const px = qrModulePx(25)
    expect(Number.isInteger(px)).toBe(true)
    expect(px).toBeGreaterThanOrEqual(8)
    const side = (25 + 4) * px
    expect(side).toBeLessThanOrEqual(240)
    expect(side).toBeLessThan((RECEIPT_WIDTH - 28) * 0.7)
  })

  it('un QR más denso se achica solo lo necesario para caber en el papel', () => {
    const px = qrModulePx(57)
    expect(px).toBeGreaterThanOrEqual(1)
    expect((57 + 4) * px).toBeLessThanOrEqual(RECEIPT_WIDTH)
    expect(qrModulePx(57)).toBeLessThan(qrModulePx(25))
  })

  it('wrapLines parte por palabras sin pasar del ancho', () => {
    expect(wrapLines('uno dos tres cuatro', 90, measure)).toEqual(['uno dos', 'tres', 'cuatro'])
    expect(wrapLines('', 90, measure)).toEqual([])
  })

  it('wrapLines corta por letras una palabra más ancha que la línea', () => {
    const lines = wrapLines('Internacionalizacion', 80, measure)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => measure(l) <= 80)).toBe(true)
    expect(lines.join('')).toBe('Internacionalizacion')
  })
})
