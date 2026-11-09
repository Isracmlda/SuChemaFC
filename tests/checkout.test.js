import { describe, expect, it } from 'vitest'
import {
  buildOrder,
  buildOrderLines,
  buildTrackingSummary,
  buildWhatsAppMessage,
  customerPayload,
  emptyCustomer,
  generateTrackingCode,
  minAdvance,
  normalizePhone,
  orderRef,
  orderTotal,
  shippingFee,
  trackingUrl,
  validateCustomer,
  whatsappLink,
} from '../src/features/checkout/checkout.js'
import {
  DEFAULT_SHIPPING,
  enabledMethods,
  normalizeCheckoutSettings,
  validateMethod,
  validateSettingsForm,
} from '../src/features/checkout/settings.js'

const form = (over = {}) => ({
  ...emptyCustomer(),
  name: 'Ana Mora',
  phone: '8888-8888',
  email: 'ana@x.com',
  ...over,
})
const address = {
  province: 'Heredia',
  canton: 'Barva',
  district: 'San Pedro',
  details: '200 m norte de la iglesia',
}

describe('teléfono', () => {
  it('normaliza el prefijo de Costa Rica', () => {
    expect(normalizePhone('+506 8888-8888')).toBe('88888888')
    expect(normalizePhone('(506) 8888 8888')).toBe('88888888')
    expect(normalizePhone('8888 8888')).toBe('88888888')
  })
})

describe('validación de datos del cliente', () => {
  it('acepta WhatsApp sin dirección y Correos con dirección completa', () => {
    expect(validateCustomer(form(), 'whatsapp')).toEqual({})
    expect(validateCustomer(form(address), 'correos')).toEqual({})
  })

  it('exige nombre y teléfono', () => {
    const errors = validateCustomer(form({ name: ' ', phone: '123' }), 'whatsapp')
    expect(errors.name).toBeTruthy()
    expect(errors.phone).toBeTruthy()
  })

  it('acepta teléfono internacional solo con +', () => {
    expect(validateCustomer(form({ phone: '+34 600 123 456' }), 'whatsapp').phone).toBeUndefined()
    expect(validateCustomer(form({ phone: '600123456' }), 'whatsapp').phone).toBeTruthy()
  })

  it('el correo es obligatorio y debe ser válido', () => {
    expect(validateCustomer(form({ email: '' }), 'whatsapp').email).toBeTruthy()
    expect(validateCustomer(form({ email: '   ' }), 'whatsapp').email).toBeTruthy()
    expect(validateCustomer(form({ email: 'ana@x' }), 'whatsapp').email).toBeTruthy()
    expect(validateCustomer(form({ email: 'ana@x.com' }), 'whatsapp').email).toBeUndefined()
  })

  it('Correos exige provincia, cantón, distrito y señas', () => {
    const errors = validateCustomer(form(), 'correos')
    expect(Object.keys(errors).sort()).toEqual(['canton', 'details', 'district', 'province'])
    expect(
      validateCustomer(form({ ...address, province: 'Marte' }), 'correos').province,
    ).toBeTruthy()
  })
})

describe('datos que se guardan', () => {
  it('no incluye claves vacías ni dirección en WhatsApp', () => {
    const { customer, customerNote } = customerPayload(form({ email: '' }), 'whatsapp')
    expect(customer).toEqual({ name: 'Ana Mora', phone: '88888888' })
    expect(customerNote).toBeNull()
  })

  it('incluye correo, dirección y nota cuando existen', () => {
    const { customer, customerNote } = customerPayload(
      form({ ...address, email: ' ana@x.com ', note: ' Timbre dañado ' }),
      'correos',
    )
    expect(customer.email).toBe('ana@x.com')
    expect(customer.address).toEqual(address)
    expect(customerNote).toBe('Timbre dañado')
  })

  it('conserva el + de un teléfono internacional', () => {
    expect(customerPayload(form({ phone: '+34 600 123 456' }), 'whatsapp').customer.phone).toBe(
      '+34600123456',
    )
  })
})

describe('totales y adelanto', () => {
  it('el total suma el envío y resta el descuento', () => {
    expect(orderTotal({ subtotal: 50_000, discount: 5_000, shipping: 2_500 })).toBe(47_500)
  })

  it('Correos cobra la tarifa; WhatsApp no', () => {
    expect(shippingFee('correos', { correosFee: 2_500 })).toBe(2_500)
    expect(shippingFee('whatsapp', { correosFee: 2_500 })).toBe(0)
  })

  it('el adelanto sube al colón siguiente y nunca pasa del total', () => {
    expect(minAdvance(47_501, 50)).toBe(23_751)
    expect(minAdvance(20_000, 50)).toBe(10_000)
    expect(minAdvance(20_000, 100)).toBe(20_000)
    expect(minAdvance(1, 50)).toBe(1)
  })
})

describe('líneas del pedido', () => {
  const items = [
    {
      status: 'ok',
      unit: 26_500,
      patches: [{ group: 'Liga', name: 'Champions', price: 1_500 }],
      product: { name: 'Barcelona 24/25' },
      line: { productId: 'p1', size: 'M', qty: 2, custom: { name: 'LEO', number: '10' } },
    },
    { status: 'unavailable', line: { productId: 'x' }, product: null },
  ]

  it('toma solo las disponibles y guarda nombre y precio del momento', () => {
    const lines = buildOrderLines(items)
    expect(lines).toEqual([
      {
        productId: 'p1',
        name: 'Barcelona 24/25',
        size: 'M',
        patches: [{ group: 'Liga', name: 'Champions', price: 1_500 }],
        custom: { name: 'LEO', number: '10' },
        qty: 2,
        unitPrice: 26_500,
      },
    ])
    expect(buildTrackingSummary(lines)).toEqual([{ name: 'Barcelona 24/25', size: 'M', qty: 2 }])
  })

  it('con versión guarda variantId y compone el nombre "Camisa · Versión"', () => {
    const lines = buildOrderLines([
      {
        ...items[0],
        variantName: 'Mujer',
        line: { ...items[0].line, variantId: 'mujer' },
      },
    ])
    expect(lines[0].variantId).toBe('mujer')
    expect(lines[0].name).toBe('Barcelona 24/25 · Mujer')
    expect(buildTrackingSummary(lines)).toEqual([
      { name: 'Barcelona 24/25 · Mujer', size: 'M', qty: 2 },
    ])
  })

  it('la versión base no agrega variantId ni cambia el nombre', () => {
    const [line] = buildOrderLines([{ ...items[0], variantName: null }])
    expect('variantId' in line).toBe(false)
    expect(line.name).toBe('Barcelona 24/25')
  })

  it('el mensaje de WhatsApp muestra la versión a través del nombre', () => {
    const [line] = buildOrderLines([
      { ...items[0], variantName: 'Niño', line: { ...items[0].line, variantId: 'nino' } },
    ])
    const text = buildWhatsAppMessage({
      customerName: 'Ana',
      code: 'abc',
      link: 'https://x/?pedido=abc',
      lines: [line],
      totals: { total: 53_000, advanceRequired: 26_500 },
      method: 'whatsapp',
    })
    expect(text).toContain('2 × Barcelona 24/25 · Niño (talla M')
  })
})

describe('código de rastreo', () => {
  it('son 32 caracteres hexadecimales distintos cada vez', () => {
    const a = generateTrackingCode()
    const b = generateTrackingCode()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })

  it('el enlace usa un parámetro, no una ruta', () => {
    expect(trackingUrl('https://suchema.web.app', 'abc')).toBe(
      'https://suchema.web.app/?pedido=abc',
    )
  })
})

describe('WhatsApp', () => {
  it('arma el enlace con prefijo de Costa Rica y texto codificado', () => {
    expect(whatsappLink('8888-8888', 'Hola ñ')).toBe(
      `https://wa.me/50688888888?text=${encodeURIComponent('Hola ñ')}`,
    )
    expect(whatsappLink('+506 8888 8888', 'x')).toContain('wa.me/50688888888')
    expect(whatsappLink('', 'x')).toBe('')
  })

  it('el mensaje resume el pedido', () => {
    const lines = [
      {
        name: 'Barça',
        size: 'M',
        qty: 2,
        patches: [{ name: 'Champions' }],
        custom: { name: 'LEO', number: '10' },
      },
    ]
    const text = buildWhatsAppMessage({
      customerName: 'Ana',
      code: 'abc123',
      link: 'https://x/?pedido=abc123',
      lines,
      totals: { total: 50_000, advanceRequired: 25_000 },
      method: 'correos',
    })
    expect(text).toContain('soy Ana')
    expect(text).toContain('2 × Barça (talla M, Champions, personalizada LEO 10)')
    expect(text).toContain('Correos de Costa Rica')
    expect(text).toContain('Código: abc123')
  })
})

describe('ajustes de la tienda', () => {
  it('no está lista sin advancePercent válido', () => {
    expect(normalizeCheckoutSettings({}).ready).toBe(false)
    expect(normalizeCheckoutSettings({ payment: { advancePercent: 0 } }).ready).toBe(false)
    expect(normalizeCheckoutSettings({ payment: { advancePercent: 50 } }).ready).toBe(true)
  })

  it('completa con textos por defecto y ordena solo los métodos visibles', () => {
    const s = normalizeCheckoutSettings(
      { payment: { advancePercent: 40 }, shipping: { correosFee: 3000 } },
      [
        { id: 'b', order: 2, visible: true },
        { id: 'a', order: 1 },
        { id: 'c', order: 0, visible: false },
      ],
    )
    expect(s.shipping.correosFee).toBe(3000)
    expect(s.shipping.whatsappText).toBe(DEFAULT_SHIPPING.whatsappText)
    expect(s.methods.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('formas de entrega activas', () => {
    expect(enabledMethods({ correosEnabled: true, whatsappEnabled: false })).toEqual(['correos'])
    expect(enabledMethods(DEFAULT_SHIPPING)).toEqual(['correos', 'whatsapp'])
  })

  it('valida el formulario del admin', () => {
    const ok = { advancePercent: 50, shipping: DEFAULT_SHIPPING, whatsappNumber: '8888-8888' }
    expect(validateSettingsForm(ok)).toBe('')
    expect(validateSettingsForm({ ...ok, advancePercent: 0 })).toMatch(/adelanto/)
    expect(
      validateSettingsForm({ ...ok, shipping: { ...DEFAULT_SHIPPING, correosFee: -1 } }),
    ).toMatch(/tarifa/)
    expect(
      validateSettingsForm({
        ...ok,
        shipping: { ...DEFAULT_SHIPPING, correosEnabled: false, whatsappEnabled: false },
      }),
    ).toMatch(/al menos una/)
    expect(validateSettingsForm({ ...ok, whatsappNumber: '123' })).toMatch(/WhatsApp/)
    expect(validateSettingsForm({ ...ok, whatsappNumber: '' })).toBe('')
    expect(validateMethod({ number: '', holder: 'x' })).toBeTruthy()
    expect(validateMethod({ number: '8888', holder: 'Chema' })).toBe('')
  })
})

describe('documento del pedido', () => {
  const base = {
    uid: 'u1',
    trackingCode: 'a'.repeat(32),
    form: form(),
    method: 'whatsapp',
    lines: [
      {
        productId: 'p1',
        name: 'X',
        size: 'M',
        patches: [],
        custom: null,
        qty: 1,
        unitPrice: 20_000,
      },
    ],
    subtotal: 20_000,
    discount: 0,
    shipping: 0,
    advanceRequired: 10_000,
    receiptFileId: 'drive123',
  }

  it('cumple la forma que exigen las reglas', () => {
    const order = buildOrder(base)
    expect(order.total).toBe(20_000)
    expect(order.status).toBe('pago_pendiente_revision')
    expect(order).toMatchObject({ paidAmount: 0, payments: [], deleted: false })
    expect('couponCode' in order).toBe(false)
    expect('customerNote' in order).toBe(false)
    expect(order.receiptFileId).toBe('drive123')
  })

  it('incluye el cupón solo si hubo descuento', () => {
    expect(buildOrder({ ...base, couponCode: 'VERANO', discount: 0 }).couponCode).toBeUndefined()
    const order = buildOrder({
      ...base,
      couponCode: 'VERANO',
      discount: 2_000,
      advanceRequired: 9_000,
    })
    expect(order.couponCode).toBe('VERANO')
    expect(order.total).toBe(18_000)
  })

  it('la referencia usa los 8 primeros caracteres en mayúscula', () => {
    expect(orderRef('abcdef1234567890')).toBe('ABCDEF12')
  })
})
