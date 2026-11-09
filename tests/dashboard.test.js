import { describe, expect, it } from 'vitest'
import {
  AUDIT_ACTIONS,
  distinct,
  endOfDay,
  filterAudit,
  startOfDay,
} from '../src/features/admin/audit/audit.js'
import {
  backupName,
  catalogCsv,
  customersCsv,
  customersFromOrders,
  ordersCsv,
  plain,
  toJson,
} from '../src/features/admin/dashboard/exports.js'
import {
  countStatuses,
  isSale,
  periodStart,
  productReport,
  summarize,
} from '../src/features/admin/dashboard/stats.js'

const line = (productId, name, qty, unitPrice) => ({ productId, name, size: 'M', qty, unitPrice })
const order = (over) => ({
  id: 'abcdef123456',
  status: 'adelanto_confirmado',
  deleted: false,
  total: 20000,
  paidAmount: 10000,
  discount: 0,
  shipping: 0,
  lines: [line('p1', 'Camisa A', 1, 20000)],
  customer: { name: 'Ana', phone: '88887777' },
  createdAt: 1000,
  ...over,
})
const ts = (ms) => ({ toMillis: () => ms })

describe('dashboard: estadísticas', () => {
  it('solo cuentan como venta los pedidos con adelanto confirmado y no cancelados', () => {
    expect(isSale(order())).toBe(true)
    expect(isSale(order({ status: 'entregado' }))).toBe(true)
    expect(isSale(order({ status: 'pago_pendiente_revision' }))).toBe(false)
    expect(isSale(order({ status: 'pago_rechazado' }))).toBe(false)
    expect(isSale(order({ status: 'cancelado', deleted: true }))).toBe(false)
    expect(isSale(order({ deleted: true }))).toBe(false)
  })

  it('cuenta los pedidos por estado, incluidos los que están en cero', () => {
    const counts = countStatuses(
      [order(), order({ status: 'entregado' }), order({ status: 'otro' })],
      ['adelanto_confirmado', 'entregado', 'cancelado'],
    )
    expect(counts).toEqual({ adelanto_confirmado: 1, entregado: 1, cancelado: 0 })
  })

  it('calcula ventas, cobrado y saldo', () => {
    const s = summarize([
      order(),
      order({ id: 'b', total: 30000, paidAmount: 30000, discount: 1000, shipping: 2500 }),
      order({ id: 'c', status: 'pago_pendiente_revision', total: 99999 }),
      order({ id: 'd', status: 'cancelado', deleted: true, total: 5 }),
    ])
    expect(s.orders).toBe(4)
    expect(s.sales).toEqual({
      count: 2,
      sold: 50000,
      collected: 40000,
      pending: 10000,
      discounts: 1000,
      shipping: 2500,
      average: 25000,
    })
    expect(s.inProgress).toBe(3)
  })

  it('calcula costo y margen por camisa y avisa de las que no tienen costo', () => {
    const orders = [
      order({ lines: [line('p1', 'Camisa A', 2, 20000), line('p2', 'Camisa B', 1, 15000)] }),
      order({ id: 'x', lines: [line('p1', 'Camisa A', 1, 20000)] }),
    ]
    const report = productReport(orders, { p1: 12000 })
    expect(report[0]).toMatchObject({
      productId: 'p1',
      qty: 3,
      revenue: 60000,
      cost: 36000,
      margin: 24000,
      marginPct: 40,
    })
    expect(report[1]).toMatchObject({ productId: 'p2', cost: null, margin: null, marginPct: null })
    const s = summarize(orders, { p1: 12000 })
    expect(s.margin).toMatchObject({ revenue: 60000, cost: 36000, margin: 24000, withoutCost: 1 })
  })

  describe('costo y margen por versión', () => {
    const vline = (variantId, qty, unitPrice) => ({
      ...line('p1', variantId ? `Camisa A · ${variantId}` : 'Camisa A', qty, unitPrice),
      ...(variantId ? { variantId } : {}),
    })
    const orders = [
      order({ lines: [vline('mujer', 2, 18000), vline('nino', 1, 15000), vline(null, 1, 20000)] }),
    ]

    it('usa variantCosts por versión y el costo de la camisa si la versión no tiene', () => {
      const report = productReport(orders, { p1: 12000 }, { p1: { mujer: 9000 } })
      expect(report).toHaveLength(3)
      const byVariant = Object.fromEntries(report.map((r) => [r.variantId ?? 'base', r]))
      expect(byVariant.mujer).toMatchObject({ qty: 2, revenue: 36000, cost: 18000, margin: 18000 })
      expect(byVariant.nino).toMatchObject({ qty: 1, revenue: 15000, cost: 12000, margin: 3000 })
      expect(byVariant.base).toMatchObject({ qty: 1, revenue: 20000, cost: 12000, margin: 8000 })
      expect(new Set(report.map((r) => r.key)).size).toBe(3)
    })

    it('sin variantCosts separa por versión pero conserva el costo de la camisa', () => {
      const report = productReport(orders, { p1: 12000 })
      expect(report).toHaveLength(3)
      expect(report.every((r) => r.unitCost === 12000)).toBe(true)
    })

    it('una versión sin costo propio ni costo de camisa queda sin costo', () => {
      const s = summarize(orders, {}, { p1: { mujer: 9000 } })
      expect(s.products.find((p) => p.variantId === 'mujer').cost).toBe(18000)
      expect(s.products.find((p) => p.variantId === 'nino').cost).toBeNull()
      expect(s.margin).toMatchObject({ revenue: 36000, cost: 18000, withoutCost: 2 })
    })

    it('líneas sin variantId conservan el comportamiento de siempre (una fila por camisa)', () => {
      const old = [
        order({ lines: [line('p1', 'Camisa A', 2, 20000), line('p1', 'Camisa A', 1, 20000)] }),
      ]
      const report = productReport(old, { p1: 12000 }, { p1: { mujer: 9000 } })
      expect(report).toHaveLength(1)
      expect(report[0]).toMatchObject({ productId: 'p1', variantId: null, qty: 3, cost: 36000 })
    })
  })

  it('sin ventas no hay división por cero', () => {
    const s = summarize([])
    expect(s.sales.average).toBe(0)
    expect(s.margin.marginPct).toBeNull()
  })

  it('el inicio del periodo', () => {
    const now = 100 * 86_400_000
    expect(periodStart('7d', now)).toBe(93 * 86_400_000)
    expect(periodStart('all', now)).toBe(0)
  })
})

describe('respaldos', () => {
  it('convierte Timestamps a texto ISO', () => {
    expect(plain({ a: ts(0), b: [ts(86_400_000)], c: 'x' })).toEqual({
      a: '1970-01-01T00:00:00.000Z',
      b: ['1970-01-02T00:00:00.000Z'],
      c: 'x',
    })
    expect(JSON.parse(toJson([{ at: ts(0) }]))[0].at).toBe('1970-01-01T00:00:00.000Z')
  })

  it('el CSV de pedidos lleva BOM, encabezado y neutraliza fórmulas', () => {
    const csv = ordersCsv([order({ customer: { name: '=HYPERLINK("x")', phone: '88887777' } })])
    expect(csv.startsWith('\uFEFF"Pedido"')).toBe(true)
    expect(csv).toContain('ABCDEF12')
    expect(csv).toContain(`"'=HYPERLINK`)
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('agrupa clientes por teléfono sin contar pedidos cancelados', () => {
    const clients = customersFromOrders([
      order({ createdAt: 1 }),
      order({
        id: 'b',
        total: 5000,
        createdAt: 5,
        customer: { name: 'Ana López', phone: '88887777' },
      }),
      order({ id: 'c', status: 'cancelado', deleted: true, total: 99999 }),
      order({ id: 'd', customer: { name: 'Luis', phone: '70001111' }, total: 1000 }),
    ])
    expect(clients).toHaveLength(2)
    expect(clients[0]).toMatchObject({ name: 'Ana López', orders: 2, spent: 25000 })
    expect(customersCsv([order()])).toContain('88887777')
  })

  it('el CSV del catálogo incluye el costo cuando se conoce', () => {
    const csv = catalogCsv([{ id: 'p1', name: 'A', price: 20000, visible: true, deleted: false }], {
      p1: 12000,
    })
    expect(csv).toContain('"12000"')
  })

  it('el CSV del catálogo incluye filas por versión con sus precios y costos', () => {
    const productWithVariants = {
      id: 'p1',
      name: 'Camisa Real',
      price: 20000,
      baseVariantName: 'Manga Corta',
      visible: true,
      deleted: false,
      variants: [
        { id: 'v1', name: 'Manga Larga', price: 23000, visible: true },
        { id: 'v2', name: 'Mujer', visible: false },
      ],
    }
    const costs = { p1: 11000 }
    const variantCosts = { p1: { v1: 13500 } }

    const csv = catalogCsv([productWithVariants], costs, variantCosts)
    expect(csv).toContain('"Camisa Real · Manga Corta"')
    expect(csv).toContain('"11000"')
    expect(csv).toContain('"Camisa Real · Manga Larga"')
    expect(csv).toContain('"23000"')
    expect(csv).toContain('"13500"')
    expect(csv).toContain('"Camisa Real · Mujer"')
  })

  it('nombre de archivo con la fecha', () => {
    expect(backupName('pedidos', 'csv', Date.UTC(2026, 10, 8, 12))).toBe(
      'suchemafc-pedidos-2026-11-08.csv',
    )
  })
})

describe('visor de bitácora', () => {
  const entries = [
    {
      id: '1',
      action: 'crear',
      collection: 'products',
      summary: 'Camisa Real',
      createdAt: ts(1000),
      actorUid: 'u1',
    },
    {
      id: '2',
      action: 'editar',
      collection: 'orders',
      summary: 'ABC entregado',
      createdAt: ts(5000),
      actorUid: 'u2',
      docId: 'zz9',
    },
    {
      id: '3',
      action: 'editar',
      collection: 'products',
      summary: 'Precio',
      createdAt: ts(9000),
      actorUid: 'u1',
    },
  ]

  it('filtra por acción, colección, texto y fechas', () => {
    expect(filterAudit(entries, { action: 'editar' })).toHaveLength(2)
    expect(filterAudit(entries, { collection: 'products' })).toHaveLength(2)
    expect(filterAudit(entries, { query: 'zz9' })).toHaveLength(1)
    expect(filterAudit(entries, { query: 'camisa' })).toHaveLength(1)
    expect(filterAudit(entries, { from: 2000, to: 6000 }).map((e) => e.id)).toEqual(['2'])
    expect(filterAudit(entries, {})).toHaveLength(3)
  })

  it('valores distintos, acciones y días', () => {
    expect(distinct(entries, 'collection')).toEqual(['orders', 'products'])
    expect(AUDIT_ACTIONS).toContain('eliminar')
    expect(startOfDay('')).toBeNull()
    expect(endOfDay('2026-11-08') - startOfDay('2026-11-08')).toBe(86_400_000 - 1)
  })
})
