import { describe, expect, it } from 'vitest'
import {
  NAME_MAX,
  describeCustom,
  personalizationValue,
  previewNameSize,
  sanitizeName,
  sanitizeNumber,
  validatePersonalization,
} from '../src/features/personalization/personalization.js'
import {
  SEED_CHARTS,
  kindsOf,
  addMeasure,
  addRow,
  cmToIn,
  emptyChart,
  formatMeasure,
  removeMeasure,
  validateChart,
} from '../src/features/sizeChart/chart.js'

describe('personalización: limpieza de texto', () => {
  it('pasa a mayúsculas y quita símbolos', () => {
    // Conserva el espacio final para poder seguir escribiendo; se recorta al guardar.
    expect(sanitizeName('  messi 10!')).toBe('MESSI ')
    expect(sanitizeName('ana ')).toBe('ANA ')
    expect(personalizationValue({ enabled: true, name: 'ana ', number: '' }).name).toBe('ANA')
    expect(sanitizeName("o'higgins")).toBe("O'HIGGINS")
    expect(sanitizeName('peña  núñez')).toBe('PEÑA NÚÑEZ')
  })

  it('recorta al máximo', () => {
    expect(sanitizeName('a'.repeat(30))).toHaveLength(NAME_MAX)
  })

  it('el número deja solo dos dígitos', () => {
    expect(sanitizeNumber('1a0b9')).toBe('10')
    expect(sanitizeNumber('007')).toBe('00')
    expect(sanitizeNumber('')).toBe('')
  })
})

describe('personalización: validación', () => {
  it('sin personalizar siempre es válida', () => {
    expect(validatePersonalization({ enabled: false, name: '', number: '' }).valid).toBe(true)
    expect(personalizationValue({ enabled: false, name: 'x', number: '1' })).toBeNull()
  })

  it('exige nombre o número', () => {
    const r = validatePersonalization({ enabled: true, name: '  ', number: '' })
    expect(r.valid).toBe(false)
    expect(r.errors.general).toBeTruthy()
    expect(validatePersonalization({ enabled: true, name: 'Ana', number: '' }).valid).toBe(true)
    expect(validatePersonalization({ enabled: true, name: '', number: '7' }).valid).toBe(true)
  })

  it('devuelve el valor limpio para guardar', () => {
    expect(personalizationValue({ enabled: true, name: ' ana ', number: '9x' })).toEqual({
      name: 'ANA',
      number: '9',
    })
  })

  it('exige competición solo si la camisa las ofrece', () => {
    const base = { enabled: true, name: 'Ana', number: '' }
    expect(
      validatePersonalization(base, { requireCompetition: true }).errors.competition,
    ).toBeTruthy()
    expect(
      validatePersonalization({ ...base, competition: 'Liga' }, { requireCompetition: true }).valid,
    ).toBe(true)
    expect(validatePersonalization(base).valid).toBe(true)
  })

  it('guarda la competición y la muestra junto al estampado', () => {
    const value = personalizationValue({
      enabled: true,
      name: 'ana',
      number: '9',
      competition: 'Champions',
    })
    expect(value).toEqual({ name: 'ANA', number: '9', competition: 'Champions' })
    expect(describeCustom(value)).toBe('ANA 9 (Champions)')
    expect(describeCustom({ name: 'ANA', number: '' })).toBe('ANA')
    expect(describeCustom(null)).toBe('')
  })

  it('el tamaño de la vista previa se mantiene en rango', () => {
    expect(previewNameSize('A')).toBe(18)
    expect(previewNameSize('A'.repeat(12))).toBeLessThan(18)
    expect(previewNameSize('A'.repeat(100))).toBe(9)
  })
})

describe('tabla de tallas', () => {
  it('convierte cm a pulgadas', () => {
    expect(cmToIn(2.54)).toBeCloseTo(1)
    expect(formatMeasure(52, 'cm')).toBe('52')
    expect(formatMeasure(52, 'in')).toBe('20.5')
    expect(formatMeasure(null, 'cm')).toBe('—')
  })

  it('agrega y quita medidas manteniendo las filas alineadas', () => {
    let chart = emptyChart()
    chart = addMeasure(chart, 'Manga')
    expect(chart.measures).toHaveLength(3)
    expect(chart.rows[0].values).toHaveLength(3)
    chart = removeMeasure(chart, 0)
    expect(chart.measures).toEqual(['Ancho', 'Manga'])
    expect(chart.rows[0].values).toHaveLength(2)
    expect(addRow(chart).rows[1].values).toHaveLength(2)
  })

  it('valida la estructura', () => {
    const base = { ...emptyChart(), name: 'Hombre' }
    expect(validateChart({ ...base, rows: [{ size: 'M', values: [1, 2] }] })).toBe('')
    expect(validateChart({ ...base, name: ' ' })).toMatch(/nombre/)
    expect(validateChart(base)).toMatch(/talla/)
    expect(validateChart({ ...base, measures: [] })).toMatch(/medida/)
    expect(
      validateChart({
        ...base,
        rows: [
          { size: 'M', values: [1, 2] },
          { size: 'm', values: [1, 2] },
        ],
      }),
    ).toMatch(/repetidas/)
  })

  it('los datos iniciales son válidos y coherentes', () => {
    expect(SEED_CHARTS).toHaveLength(16)
    for (const chart of SEED_CHARTS) {
      expect(validateChart(chart)).toBe('')
      expect(kindsOf(chart)).toHaveLength(chart.measures.length)
      for (const row of chart.rows) expect(row.values).toHaveLength(chart.measures.length)
    }
    expect(new Set(SEED_CHARTS.map((c) => c.name)).size).toBe(SEED_CHARTS.length)
  })

  it('las guías iniciales conservan los datos del proveedor', () => {
    const fan = SEED_CHARTS.find((c) => c.name.includes('aficionado'))
    expect(fan.rows.find((r) => r.size === '4XL').values).toEqual([
      '61-64',
      '81-84',
      '197-200',
      '104-110',
    ])
    const mujer = SEED_CHARTS.find((c) => c.name === 'Camiseta mujer')
    expect(mujer.rows.map((r) => r.size)).toEqual(['S', 'M', 'L', 'XL', 'XXL'])
    expect(mujer.rows[0].values.slice(0, 3)).toEqual([63, 42, 39])
    const kids = SEED_CHARTS.find((c) => c.name === 'Camiseta y short niño')
    expect(kids.rows.find((r) => r.size === '20').values).toEqual(['5-6', '115/125', 50, 36.5, 36])
  })

  it('los rangos se convierten a pulgadas y las columnas de texto no', () => {
    expect(formatMeasure('48-50', 'in')).toBe('18.9-19.7')
    expect(formatMeasure('160/170', 'cm')).toBe('160/170')
    expect(formatMeasure('50-62', 'in', 'plain')).toBe('50-62')
    expect(formatMeasure(36.5, 'cm')).toBe('36.5')
    expect(kindsOf({ measures: ['a', 'b'] })).toEqual(['length', 'length'])
  })
})
