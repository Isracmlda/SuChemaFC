import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTENT,
  DEFAULT_WA_MESSAGE,
  buildContentDoc,
  fillTemplate,
  normalizeContent,
  parseBlocks,
  parseInline,
  templateVars,
  validateContent,
} from '../src/features/content/content.js'

describe('contenido informativo', () => {
  it('sin documento usa los textos iniciales', () => {
    const c = normalizeContent(null)
    expect(c.faq).toEqual(DEFAULT_CONTENT.faq)
    expect(c.whatsappMessage).toBe(DEFAULT_WA_MESSAGE)
    expect(c.leadDays).toBe(30)
  })

  it('ignora datos inválidos y respeta una lista de preguntas vacía', () => {
    const c = normalizeContent({
      faq: [{ q: 'a', a: 'b' }, { q: '', a: 'x' }, null, { q: 1, a: 2 }],
      howToBuy: 5,
      whatsappMessage: '   ',
      leadDays: -3,
    })
    expect(c.faq).toEqual([{ q: 'a', a: 'b' }])
    expect(c.howToBuy).toBe(DEFAULT_CONTENT.howToBuy)
    expect(c.whatsappMessage).toBe(DEFAULT_WA_MESSAGE)
    expect(c.leadDays).toBe(30)
    expect(normalizeContent({ faq: [] }).faq).toEqual([])
  })

  it('llena los marcadores con los ajustes y deja los desconocidos', () => {
    const vars = templateVars({ advancePercent: 40, correosFee: 2500, leadDays: 45 })
    expect(vars.adelanto).toBe('40%')
    expect(vars.plazo).toBe('45 días')
    expect(vars.tarifa).toContain('2')
    expect(templateVars({ advancePercent: 50, correosFee: 0, leadDays: 30 }).tarifa).toBe(
      'sin costo extra',
    )
    expect(fillTemplate('Adelanto {adelanto} y {otro}', vars)).toBe('Adelanto 40% y {otro}')
  })

  it('convierte el texto simple en bloques sin HTML', () => {
    const blocks = parseBlocks('## Título\n\nUna línea\nsigue.\n\n- uno\n- dos\n\n1. a\n2) b')
    expect(blocks).toEqual([
      { type: 'h', text: 'Título' },
      { type: 'p', text: 'Una línea sigue.' },
      { type: 'ul', items: ['uno', 'dos'] },
      { type: 'ol', items: ['a', 'b'] },
    ])
    expect(parseBlocks('<script>x</script>')).toEqual([{ type: 'p', text: '<script>x</script>' }])
    expect(parseBlocks('')).toEqual([])
  })

  it('reconoce negritas', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ])
  })

  it('valida longitudes, preguntas, mensaje y plazo', () => {
    const ok = normalizeContent(null)
    expect(validateContent(ok)).toBe('')
    expect(validateContent({ ...ok, howToBuy: 'x'.repeat(5001) })).toMatch(/Cómo comprar/)
    expect(validateContent({ ...ok, faq: [{ q: '', a: 'x' }] })).toMatch(/pregunta 1/)
    expect(validateContent({ ...ok, whatsappMessage: ' ' })).toMatch(/WhatsApp/)
    expect(validateContent({ ...ok, leadDays: 0 })).toMatch(/plazo/)
    expect(validateContent({ ...ok, leadDays: 1.5 })).toMatch(/plazo/)
  })

  it('arma el documento recortando espacios', () => {
    const doc = buildContentDoc({
      ...normalizeContent(null),
      terms: '  hola  ',
      faq: [{ q: ' ¿a? ', a: ' b ' }],
    })
    expect(doc.terms).toBe('hola')
    expect(doc.faq).toEqual([{ q: '¿a?', a: 'b' }])
  })
})
