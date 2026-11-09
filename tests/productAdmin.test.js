import { describe, expect, it } from 'vitest'
import { chartSizes } from '../src/features/sizeChart/chart.js'
import {
  applyChartSizes,
  areSizesStandard,
  cleanVariantCosts,
  cleanVariantForSave,
  makeVariantId,
  normalizeSizes,
  parseCustomSizes,
  validateChartId,
  validateSizes,
  validateVariants,
} from '../src/features/admin/catalog/productAdmin.js'
import { SIZES } from '../src/utils/constants.js'

describe('productAdmin: lógica de administración de versiones y tallas', () => {
  describe('makeVariantId', () => {
    it('genera un id único que empieza con v_', () => {
      const id1 = makeVariantId()
      const id2 = makeVariantId()
      expect(id1).toMatch(/^v_[a-z0-9]+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('parseCustomSizes', () => {
    it('divide texto por comas y espacios descartando vacíos', () => {
      expect(parseCustomSizes('16, 18, 20')).toEqual(['16', '18', '20'])
      expect(parseCustomSizes('16   18\n20,22')).toEqual(['16', '18', '20', '22'])
      expect(parseCustomSizes('')).toEqual([])
      expect(parseCustomSizes(null)).toEqual([])
    })
  })

  describe('normalizeSizes', () => {
    it('elimina duplicados sin distinguir mayúsculas conservando el orden original', () => {
      expect(normalizeSizes(['S', 'M', 's', 'L', 'm', 'XL'])).toEqual(['S', 'M', 'L', 'XL'])
      expect(normalizeSizes([' 16 ', '18', '16'])).toEqual(['16', '18'])
      expect(normalizeSizes(null)).toEqual([])
    })
  })

  describe('areSizesStandard', () => {
    it('devuelve true solo si coincide exactamente con SIZES', () => {
      expect(areSizesStandard(SIZES)).toBe(true)
      expect(areSizesStandard(['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'])).toBe(true)
      expect(areSizesStandard(['S', 'M', 'L', 'XL'])).toBe(false)
      expect(areSizesStandard(['16', '18'])).toBe(false)
      expect(areSizesStandard([])).toBe(false)
      expect(areSizesStandard(null)).toBe(false)
    })
  })

  describe('validateSizes', () => {
    it('valida que la lista no esté vacía', () => {
      expect(validateSizes([], 'Camisa')).toContain('debe incluir al menos una talla visible')
      expect(validateSizes(null, 'Camisa')).toContain('debe incluir al menos una talla visible')
    })

    it('detecta duplicados sin distinguir mayúsculas', () => {
      expect(validateSizes(['S', 's'], 'Camisa')).toContain('talla duplicada «s»')
    })

    it('detecta tallas demasiado largas o vacías', () => {
      expect(validateSizes(['', 'M'], 'Camisa')).toContain('contiene tallas vacías')
      expect(validateSizes(['TALLAMUYEXTENSASUPERLARGA', 'M'], 'Camisa')).toContain(
        'es demasiado larga',
      )
    })

    it('devuelve null si es válida', () => {
      expect(validateSizes(['S', 'M', 'L', 'XL'])).toBeNull()
      expect(validateSizes(['16', '18', '20'])).toBeNull()
    })
  })

  describe('validateVariants', () => {
    it('devuelve null si no hay versiones', () => {
      expect(validateVariants([])).toBeNull()
      expect(validateVariants(null)).toBeNull()
    })

    it('exige nombre obligatorio', () => {
      const variants = [{ id: 'v1', name: '' }]
      expect(validateVariants(variants)).toContain('el nombre es obligatorio')
    })

    it('exige nombres únicos sin distinguir mayúsculas', () => {
      const variants = [
        { id: 'v1', name: 'Hombre' },
        { id: 'v2', name: 'hombre' },
      ]
      expect(validateVariants(variants)).toContain('Ya existe una versión llamada «hombre»')
    })

    it('valida precios enteros >= 0', () => {
      expect(validateVariants([{ id: 'v1', name: 'V1', price: -500 }])).toContain(
        'el precio debe ser un número entero',
      )
      expect(validateVariants([{ id: 'v1', name: 'V1', price: 1999.5 }])).toContain(
        'el precio debe ser un número entero',
      )
      expect(validateVariants([{ id: 'v1', name: 'V1', price: 20000 }])).toBeNull()
      expect(validateVariants([{ id: 'v1', name: 'V1', price: '' }])).toBeNull()
    })

    it('valida tallas de la versión si están definidas', () => {
      expect(validateVariants([{ id: 'v1', name: 'Mujer', sizes: [] }])).toContain(
        'debe incluir al menos una talla visible',
      )
      expect(validateVariants([{ id: 'v1', name: 'Mujer', sizes: ['S', 'M', 's'] }])).toContain(
        'talla duplicada',
      )
    })

    it('valida sizeChartId contra la lista permitida', () => {
      expect(
        validateVariants(
          [{ id: 'v1', name: 'V1', sizeChartId: 'inexistente' }],
          ['adulto', 'nino'],
        ),
      ).toContain('la tabla de tallas seleccionada no existe')
      expect(
        validateVariants([{ id: 'v1', name: 'V1', sizeChartId: 'nino' }], ['adulto', 'nino']),
      ).toBeNull()
    })

    it('valida recargos de talla y de personalización', () => {
      expect(
        validateVariants([{ id: 'v1', name: 'V1', sizeSurcharges: { '2XL': -100 } }]),
      ).toContain('el recargo de la talla 2XL debe ser un entero')
      expect(
        validateVariants([
          { id: 'v1', name: 'V1', personalization: { enabled: true, surcharge: -50 } },
        ]),
      ).toContain('el recargo de personalización debe ser un entero')
    })
  })

  describe('cleanVariantForSave', () => {
    it('omite campos vacíos o no sobreescritos y preserva sale', () => {
      const raw = {
        id: ' v1 ',
        name: ' Hombre ',
        visible: true,
        price: '',
        images: [],
        sizes: ['S', 'M', 's', 'L'],
        sizeSurcharges: { '2XL': 2000, '3XL': null },
        patchGroupIds: [],
        personalization: { enabled: true, surcharge: 1500 },
        sizeChartId: '  adulto  ',
      }
      const existing = {
        id: 'v1',
        sale: { discountType: 'fixed', discountValue: 3000, active: true },
      }

      const cleaned = cleanVariantForSave(raw, existing)
      expect(cleaned).toEqual({
        id: 'v1',
        name: 'Hombre',
        visible: true,
        sizes: ['S', 'M', 'L'],
        sizeSurcharges: { '2XL': 2000 },
        personalization: { enabled: true, surcharge: 1500 },
        sizeChartId: 'adulto',
        sale: { discountType: 'fixed', discountValue: 3000, active: true },
      })
      expect(cleaned.price).toBeUndefined()
      expect(cleaned.images).toBeUndefined()
      expect(cleaned.patchGroupIds).toBeUndefined()
    })

    it('incluye precio e imágenes si están definidos', () => {
      const raw = {
        id: 'v2',
        name: 'Manga Larga',
        visible: false,
        price: 24000,
        images: ['img1', 'img2'],
        patchGroupIds: ['pg1'],
      }
      const cleaned = cleanVariantForSave(raw)
      expect(cleaned).toEqual({
        id: 'v2',
        name: 'Manga Larga',
        visible: false,
        price: 24000,
        images: ['img1', 'img2'],
        patchGroupIds: ['pg1'],
      })
    })
  })

  describe('guías de tallas ↔ tallas ofrecidas', () => {
    const adulto = { id: 'adulto', rows: [{ size: 'S' }, { size: 'M' }, { size: 'L' }] }
    const nino = { id: 'nino', rows: [{ size: ' 16 ' }, { size: '18' }, { size: '16' }] }
    const charts = [adulto, nino]

    it('chartSizes devuelve las tallas únicas en orden de filas', () => {
      expect(chartSizes(adulto)).toEqual(['S', 'M', 'L'])
      expect(chartSizes(nino)).toEqual(['16', '18'])
      expect(chartSizes(undefined)).toEqual([])
    })

    it('limita las tallas de la base a las de su guía', () => {
      const out = applyChartSizes({ sizeChartId: 'adulto', sizes: ['M', 'XL', 'S'] }, charts)
      expect(out.sizes).toEqual(['S', 'M'])
    })

    it('ofrece todas las de la guía si ninguna seleccionada coincide', () => {
      expect(applyChartSizes({ sizeChartId: 'nino', sizes: ['S', 'M'] }, charts).sizes).toEqual([
        '16',
        '18',
      ])
      expect(applyChartSizes({ sizeChartId: 'adulto' }, charts).sizes).toEqual(['S', 'M', 'L'])
    })

    it('sin guía deja las tallas sin cambios', () => {
      const p = { sizes: ['S', 'XL'], variants: [{ id: 'v1', sizes: ['2XL'] }] }
      expect(applyChartSizes(p, charts)).toEqual(p)
    })

    it('las versiones usan su guía o heredan la de la base', () => {
      const out = applyChartSizes(
        {
          sizeChartId: 'adulto',
          sizes: ['S', 'M', 'L'],
          variants: [
            { id: 'v1', sizeChartId: 'nino', sizes: ['S'] },
            { id: 'v2', sizes: ['L', 'XL'] },
          ],
        },
        charts,
      )
      expect(out.variants[0].sizes).toEqual(['16', '18'])
      expect(out.variants[1].sizes).toEqual(['L'])
    })

    it('validateChartId acepta vacío y guías existentes, rechaza inexistentes', () => {
      expect(validateChartId('', ['adulto'])).toBeNull()
      expect(validateChartId('adulto', ['adulto'])).toBeNull()
      expect(validateChartId('x', ['adulto'])).toContain('la guía de tallas seleccionada no existe')
      expect(validateChartId('x', [])).toBeNull()
    })
  })

  describe('cleanVariantCosts', () => {
    it('filtra costos de versiones eliminadas o vacías', () => {
      const variants = [
        { id: 'v1', name: 'Hombre' },
        { id: 'v2', name: 'Mujer' },
      ]
      const costs = {
        v1: 12000,
        v2: '',
        v3: 15000,
      }
      expect(cleanVariantCosts(variants, costs)).toEqual({
        v1: 12000,
      })
    })
  })
})
