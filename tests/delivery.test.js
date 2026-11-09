import { describe, expect, it } from 'vitest'
import {
  applyDelivery,
  buildQrPayload,
  deliveryBlock,
  deliveryWarning,
  parseQrPayload,
  buildLabelPayload,
  parseScanInput,
  validateDelivery,
} from '../src/features/admin/delivery/delivery.js'
import { buildReceiptModel } from '../src/features/admin/receipts/receipts.js'

const ID = 'AbCdEfGh1234567890Zz' // 20 caracteres, como los IDs de Firestore

const order = (extra = {}) => ({
  id: ID,
  trackingCode: 't'.repeat(32),
  customer: { name: 'Ana Mora', phone: '88888888' },
  shippingMethod: 'whatsapp',
  status: 'listo_para_entrega',
  deleted: false,
  total: 40000,
  subtotal: 40000,
  advanceRequired: 20000,
  payments: [{ amount: 20000, ref: 'AB1234' }],
  lines: [
    {
      productId: 'p1',
      name: 'Real Madrid',
      size: 'M',
      qty: 1,
      unitPrice: 25000,
      patches: [{ name: 'Champions' }],
      custom: { name: 'ANA', number: '10' },
    },
    { productId: 'p2', name: 'Barça ’24', size: 'L', qty: 1, unitPrice: 15000, patches: [] },
  ],
  ...extra,
})

describe('contenido del QR', () => {
  it('codifica el pedido completo y se puede leer de vuelta', () => {
    const text = buildQrPayload(ID)
    expect(text).toBe(`SCFC:${ID}`)
    expect(parseQrPayload(text)).toEqual({ orderId: ID, lineIndex: null })
  })

  it('sigue leyendo los QR antiguos, que traían la posición de la camisa', () => {
    expect(parseQrPayload(`SCFC:${ID}:1`)).toEqual({ orderId: ID, lineIndex: 1 })
  })

  it('rechaza QR ajenos o mal formados', () => {
    expect(parseQrPayload('https://ejemplo.com')).toBeNull()
    expect(parseQrPayload('SCFC:corto')).toBeNull()
    expect(parseQrPayload(`SCFC:${ID}:x`)).toBeNull()
    expect(parseQrPayload(`XXXX:${ID}`)).toBeNull()
  })

  it('acepta el QR, el ID completo o la referencia corta escritos a mano', () => {
    expect(parseScanInput(`  SCFC:${ID} `)).toEqual({ orderId: ID, lineIndex: null })
    expect(parseScanInput(`  SCFC:${ID}:0 `)).toEqual({ orderId: ID, lineIndex: 0 })
    expect(parseScanInput(ID)).toEqual({ orderId: ID, lineIndex: null })
    expect(parseScanInput('abcdefgh')).toEqual({ ref: 'ABCDEFGH' })
    expect(parseScanInput('hola mundo')).toBeNull()
    expect(parseScanInput('')).toBeNull()
  })
})

describe('puede entregarse', () => {
  it('bloquea cancelados, entregados y sin adelanto confirmado', () => {
    expect(deliveryBlock(order())).toBe('')
    expect(deliveryBlock(order({ status: 'cancelado' }))).toMatch(/cancelado/)
    expect(deliveryBlock(order({ deleted: true }))).toMatch(/cancelado/)
    expect(deliveryBlock(order({ status: 'entregado' }))).toMatch(/entregado/)
    expect(deliveryBlock(order({ status: 'pago_pendiente_revision' }))).toMatch(/adelanto/)
  })

  it('avisa, sin bloquear, si no figura como listo para entrega', () => {
    expect(deliveryWarning(order())).toBe('')
    expect(deliveryWarning(order({ status: 'en_camino' }))).toMatch(/En camino/)
    expect(deliveryBlock(order({ status: 'en_camino' }))).toBe('')
  })
})

describe('validar la entrega', () => {
  const base = { checked: [0, 1], method: 'efectivo', amount: 20000, reference: '' }

  it('exige marcar todas las camisas', () => {
    expect(validateDelivery(order(), { ...base, checked: [0] })).toMatch(/todas las camisas/)
    expect(validateDelivery(order(), { ...base, checked: [0, 0] })).toMatch(/todas las camisas/)
  })

  it('exige cobrar el saldo completo', () => {
    expect(validateDelivery(order(), base)).toBe('')
    expect(validateDelivery(order(), { ...base, amount: 5000 })).toMatch(/saldo completo/)
    expect(validateDelivery(order(), { ...base, method: 'otro' })).toMatch(/cobra/)
  })

  it('SINPE exige un número de comprobante válido', () => {
    expect(validateDelivery(order(), { ...base, method: 'sinpe', reference: '' })).toMatch(
      /comprobante/,
    )
    expect(validateDelivery(order(), { ...base, method: 'sinpe', reference: 'ZX9988' })).toBe('')
  })

  it('un pedido ya pagado se entrega sin cobro', () => {
    const paid = order({ payments: [{ amount: 40000 }] })
    expect(validateDelivery(paid, { checked: [0, 1], method: '', amount: 0, reference: '' })).toBe(
      '',
    )
  })

  it('no valida nada más si está bloqueado', () => {
    expect(validateDelivery(order({ status: 'cancelado' }), base)).toMatch(/cancelado/)
  })
})

describe('aplicar la entrega', () => {
  it('registra el saldo en efectivo y marca entregado', () => {
    const r = applyDelivery(order(), { method: 'efectivo', reference: '' }, 99)
    expect(r.status).toBe('entregado')
    expect(r.collected).toBe(20000)
    expect(r.paidAmount).toBe(40000)
    expect(r.ref).toBe('')
    expect(r.payments.at(-1)).toEqual({
      amount: 20000,
      ref: 'EFECTIVO',
      method: 'efectivo',
      at: 99,
    })
  })

  it('con SINPE guarda el número de comprobante normalizado', () => {
    const r = applyDelivery(order(), { method: 'sinpe', reference: ' zx 99_88 ' }, 99)
    expect(r.ref).toBe('ZX9988')
    expect(r.payments.at(-1)).toMatchObject({ ref: 'ZX9988', method: 'sinpe' })
  })

  it('sin saldo no agrega pagos', () => {
    const paid = order({ payments: [{ amount: 40000 }] })
    const r = applyDelivery(paid, { method: 'efectivo', reference: '' }, 99)
    expect(r.payments).toHaveLength(1)
    expect(r.collected).toBe(0)
    expect(r.status).toBe('entregado')
  })
})

describe('recibo', () => {
  it('arma un solo QR para todo el pedido, con los extras y los totales', () => {
    const m = buildReceiptModel(order())
    expect(m.ref).toBe('ABCDEFGH')
    expect(m.qrPayload).toBe(`SCFC:${ID}`)
    expect(m.items).toHaveLength(2)
    expect(m.items.every((i) => i.qrPayload === undefined)).toBe(true)
    expect(m.items[0].extras).toEqual(['Parches: Champions', 'Personalizada: ANA 10'])
    expect(m.items[1].name).toBe('Barça ’24')
    expect(m.totals).toMatchObject({ total: 40000, paid: 20000, balance: 20000 })
    expect(m.delivery).toBe('') // entrega coordinada: sin dirección
  })

  it('en envíos por Correos el recibo lleva la dirección guardada', () => {
    const address = {
      province: 'Alajuela',
      canton: 'Alajuela',
      district: 'Alajuela',
      details: '700 mts',
    }
    const m = buildReceiptModel(
      order({ shippingMethod: 'correos', customer: { name: 'Ana', phone: '88888888', address } }),
    )
    expect(m.delivery).toBe('Alajuela, Alajuela, Alajuela. 700 mts')
  })
})

describe('guía de rastreo como código de entrega', () => {
  it('parseScanInput reconoce la guía de rastreo de 32 caracteres hexadecimales', () => {
    const code = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
    expect(parseScanInput(code)).toEqual({ trackingCode: code })
    expect(parseScanInput(code.toUpperCase())).toEqual({ trackingCode: code })
  })

  it('el QR de la etiqueta lleva la guía y la posición de la camisa', () => {
    const code = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
    expect(buildLabelPayload(code, 2)).toBe(`${code}:2`)
    expect(buildLabelPayload(code, 0)).toBe(`${code}:0`)
    expect(buildLabelPayload(code, undefined)).toBe(code)
    expect(parseScanInput(`${code}:2`)).toEqual({ trackingCode: code, lineIndex: 2 })
    expect(parseScanInput(`${code.toUpperCase()}:0`)).toEqual({ trackingCode: code, lineIndex: 0 })
  })
})
