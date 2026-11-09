import { describe, expect, it } from 'vitest'
import {
  advanceMissing,
  applyPayment,
  balance,
  buildCustomerMessage,
  canCancel,
  canConfirmPayment,
  canIssueReceipt,
  canReject,
  countByStatus,
  customerWhatsApp,
  filterOrders,
  normalizeReference,
  totalPaid,
  validatePaymentForm,
} from '../src/features/admin/orders/review.js'
import { statusLabel } from '../src/features/orders/orderStatus.js'

const order = (extra = {}) => ({
  id: 'abcdef1234567890',
  trackingCode: 't'.repeat(32),
  customer: { name: 'Ana Mora', phone: '88888888' },
  status: 'pago_pendiente_revision',
  total: 40000,
  advanceRequired: 20000,
  payments: [],
  deleted: false,
  ...extra,
})

describe('comprobantes y saldos', () => {
  it('normaliza el número de comprobante', () => {
    expect(normalizeReference(' ab 12_3.4 ')).toBe('AB1234')
  })

  it('calcula pagado, saldo y adelanto faltante', () => {
    const o = order({ payments: [{ amount: 5000 }, { amount: 7000 }] })
    expect(totalPaid(o)).toBe(12000)
    expect(balance(o)).toBe(28000)
    expect(advanceMissing(o)).toBe(8000)
    expect(advanceMissing(order({ payments: [{ amount: 30000 }] }))).toBe(0)
  })

  it('valida referencia y monto', () => {
    const o = order()
    expect(validatePaymentForm(o, { reference: '12', amount: 100 })).toMatch(/comprobante/)
    expect(validatePaymentForm(o, { reference: 'AB1234', amount: 0 })).toMatch(/monto/)
    expect(validatePaymentForm(o, { reference: 'AB1234', amount: 50000 })).toMatch(/saldo/)
    expect(validatePaymentForm(o, { reference: 'AB1234', amount: 20000 })).toBe('')
  })
})

describe('registrar un pago', () => {
  it('confirma el adelanto al alcanzar el mínimo', () => {
    const r = applyPayment(order(), { reference: 'ab-1234', amount: 20000 }, 1)
    expect(r.status).toBe('adelanto_confirmado')
    expect(r.statusChanged).toBe(true)
    expect(r.paidAmount).toBe(20000)
    expect(r.ref).toBe('AB-1234')
    expect(r.payments).toEqual([{ amount: 20000, ref: 'AB-1234', at: 1 }])
  })

  it('un pago menor al adelanto queda como parcial y no cambia el estado', () => {
    const r = applyPayment(order(), { reference: 'AB1234', amount: 5000 }, 1)
    expect(r.status).toBe('pago_pendiente_revision')
    expect(r.statusChanged).toBe(false)
  })

  it('completa el adelanto con un segundo pago', () => {
    const first = applyPayment(order(), { reference: 'AB1234', amount: 5000 }, 1)
    const second = applyPayment(
      order({ payments: first.payments }),
      { reference: 'CD5678', amount: 15000 },
      2,
    )
    expect(second.paidAmount).toBe(20000)
    expect(second.status).toBe('adelanto_confirmado')
  })

  it('un pago del saldo no retrocede un pedido ya avanzado', () => {
    const o = order({ status: 'en_camino', payments: [{ amount: 20000 }] })
    const r = applyPayment(o, { reference: 'EF9012', amount: 20000 }, 3)
    expect(r.status).toBe('en_camino')
    expect(r.statusChanged).toBe(false)
  })

  it('un pago rechazado antes se reactiva al cubrir el adelanto', () => {
    const r = applyPayment(
      order({ status: 'pago_rechazado' }),
      { reference: 'AB1234', amount: 20000 },
      1,
    )
    expect(r.status).toBe('adelanto_confirmado')
  })
})

describe('acciones permitidas', () => {
  it('rechazar solo si espera revisión', () => {
    expect(canReject(order())).toBe(true)
    expect(canReject(order({ status: 'adelanto_confirmado' }))).toBe(false)
  })

  it('cancelar no aplica a entregados ni cancelados', () => {
    expect(canCancel(order())).toBe(true)
    expect(canCancel(order({ status: 'entregado' }))).toBe(false)
    expect(canCancel(order({ status: 'cancelado', deleted: true }))).toBe(false)
  })

  it('no se comprueba un pago si no hay saldo o está cancelado', () => {
    expect(canConfirmPayment(order())).toBe(true)
    expect(canConfirmPayment(order({ payments: [{ amount: 40000 }] }))).toBe(false)
    expect(canConfirmPayment(order({ status: 'cancelado', deleted: true }))).toBe(false)
  })

  it('"Comprobar pago" se oculta una vez que el adelanto se confirma', () => {
    expect(canConfirmPayment(order({ status: 'pago_rechazado' }))).toBe(true)
    expect(canConfirmPayment(order({ status: 'adelanto_confirmado' }))).toBe(false)
    expect(canConfirmPayment(order({ status: 'en_camino' }))).toBe(false)
  })

  it('el recibo aparece solo después de confirmar el pedido', () => {
    expect(canIssueReceipt(order())).toBe(false)
    expect(canIssueReceipt(order({ status: 'pago_rechazado' }))).toBe(false)
    expect(canIssueReceipt(order({ status: 'adelanto_confirmado' }))).toBe(true)
    expect(canIssueReceipt(order({ status: 'entregado' }))).toBe(true)
    expect(canIssueReceipt(order({ status: 'cancelado', deleted: true }))).toBe(false)
  })
})

describe('bandeja', () => {
  const list = [
    order({ id: 'AAAA1111xxxx' }),
    order({
      id: 'BBBB2222xxxx',
      status: 'adelanto_confirmado',
      customer: { name: 'Luis', phone: '70001111' },
    }),
    order({ id: 'CCCC3333xxxx', status: 'cancelado', deleted: true }),
  ]

  it('cuenta por estado y deja fuera a los cancelados de "todos"', () => {
    expect(countByStatus(list)).toEqual({
      all: 2,
      pago_pendiente_revision: 1,
      adelanto_confirmado: 1,
      cancelado: 1,
    })
  })

  it('filtra por estado y por texto', () => {
    expect(filterOrders(list, { status: 'all' }).map((o) => o.id)).toEqual([
      'AAAA1111xxxx',
      'BBBB2222xxxx',
    ])
    expect(filterOrders(list, { status: 'cancelado' })).toHaveLength(1)
    expect(filterOrders(list, { status: 'all', query: 'luis' })).toHaveLength(1)
    expect(filterOrders(list, { status: 'all', query: '7000' })).toHaveLength(1)
    expect(filterOrders(list, { status: 'all', query: 'aaaa1111' })).toHaveLength(1)
  })

  it('etiqueta los estados en español', () => {
    expect(statusLabel('adelanto_confirmado')).toBe('Adelanto confirmado')
    expect(statusLabel('raro')).toBe('raro')
  })
})

describe('mensajes de WhatsApp al cliente', () => {
  const o = order({ payments: [{ amount: 20000 }] })

  it('confirmado incluye lo recibido, el saldo y el enlace', () => {
    const text = buildCustomerMessage('confirmado', o, { origin: 'https://x.test' })
    expect(text).toContain('ABCDEF12')
    expect(text).toContain('Saldo pendiente')
    expect(text).toContain(`https://x.test/?pedido=${o.trackingCode}`)
  })

  it('rechazado incluye el motivo', () => {
    const text = buildCustomerMessage('rechazado', o, {
      origin: 'https://x.test',
      reason: 'monto distinto',
    })
    expect(text).toContain('monto distinto')
  })

  it('arma el enlace wa.me con el teléfono del cliente', () => {
    expect(customerWhatsApp(o, 'confirmado', { origin: 'https://x.test' })).toMatch(
      /^https:\/\/wa\.me\/50688888888\?text=/,
    )
    expect(
      customerWhatsApp({ ...o, customer: { name: 'A', phone: '' } }, 'confirmado', { origin: '' }),
    ).toBe('')
  })
})
