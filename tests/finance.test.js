import { describe, expect, it } from 'vitest'
import {
  financeRows,
  groupFinance,
  periodKey,
  supplierOrderFinance,
  totals,
  validateExpense,
} from '../src/features/admin/finance/finance.js'

const line = (qty, unitPrice) => ({ productId: 'p', name: 'Real', size: 'M', qty, unitPrice })

// A: 2 camisas de 20 000 (total 40 000 + envío 2 000), pagó 21 000. B: una camisa de 20 000.
const orders = [
  {
    id: 'A',
    lines: [line(1, 20000), line(1, 20000)],
    total: 42000,
    payments: [{ amount: 21000 }],
  },
  { id: 'B', lines: [line(1, 20000)], total: 20000, payments: [{ amount: 20000 }] },
  {
    id: 'C',
    lines: [line(1, 20000)],
    total: 20000,
    payments: [{ amount: 10000 }],
    status: 'cancelado',
  },
]

const supplierOrder = (lineRefs, extra = {}) => ({
  id: 's1',
  supplier: 'Kitmm',
  status: 'llego',
  createdAt: new Date(2026, 10, 9).getTime(),
  items: lineRefs.map(() => ({ qty: 1 })),
  lineRefs,
  totalCost: 20000,
  importCost: 4000,
  ...extra,
})

describe('finanzas por pedido al proveedor', () => {
  it('cobrado, esperado y ganancia de hoy frente al costo', () => {
    // Las dos camisas de A y la de B: esperado 42 000 + 20 000, cobrado 21 000 + 20 000.
    const so = supplierOrder([
      { orderId: 'A', lineIndex: 0 },
      { orderId: 'A', lineIndex: 1 },
      { orderId: 'B', lineIndex: 0 },
    ])
    const f = supplierOrderFinance(so, orders)
    expect(f).toMatchObject({
      cost: 24000,
      expected: 62000,
      collected: 41000,
      pending: 21000,
      profit: 17000,
      projected: 38000,
      missing: 0,
    })
  })

  it('reparte un pedido de cliente entre varios pedidos al proveedor según el peso de sus camisas', () => {
    const f = supplierOrderFinance(supplierOrder([{ orderId: 'A', lineIndex: 0 }]), orders)
    expect(f.expected).toBe(21000) // la mitad de 42 000
    expect(f.collected).toBe(10500) // la mitad de 21 000
  })

  it('con poco cobrado hay pérdida hasta hoy', () => {
    const o = [{ ...orders[1], payments: [{ amount: 5000 }] }]
    const f = supplierOrderFinance(supplierOrder([{ orderId: 'B', lineIndex: 0 }]), o)
    expect(f.profit).toBe(5000 - 24000)
    expect(f.profit).toBeLessThan(0)
  })

  it('un pedido cancelado no se espera cobrar, pero lo ya cobrado cuenta', () => {
    const f = supplierOrderFinance(supplierOrder([{ orderId: 'C', lineIndex: 0 }]), orders)
    expect(f.expected).toBe(0)
    expect(f.collected).toBe(10000)
  })

  it('cuenta las camisas cuyo pedido de cliente no existe', () => {
    const f = supplierOrderFinance(supplierOrder([{ orderId: 'X', lineIndex: 0 }]), orders)
    expect(f).toMatchObject({ missing: 1, expected: 0, collected: 0 })
  })

  it('un pedido antiguo sin importación solo cuesta las camisas', () => {
    const so = supplierOrder([{ orderId: 'B', lineIndex: 0 }], { importCost: undefined })
    expect(supplierOrderFinance(so, orders).cost).toBe(20000)
  })
})

describe('totales y compendios', () => {
  const rows = financeRows(
    [
      supplierOrder([{ orderId: 'B', lineIndex: 0 }], { id: 'nov' }),
      supplierOrder([{ orderId: 'B', lineIndex: 0 }], {
        id: 'dic',
        createdAt: new Date(2026, 11, 2).getTime(),
        totalCost: 10000,
        importCost: 0,
      }),
      supplierOrder([{ orderId: 'B', lineIndex: 0 }], {
        id: 'ene',
        createdAt: new Date(2027, 0, 5).getTime(),
      }),
    ],
    orders,
  )
  const expenses = [
    { description: 'Bolsas', amount: 3000, date: new Date(2026, 10, 20).getTime() },
    { description: 'Papel', amount: 1000, date: new Date(2027, 0, 8).getTime() },
  ]

  it('restan los costos secundarios a la ganancia', () => {
    const all = totals(rows, expenses)
    expect(all.extra).toBe(4000)
    expect(all.profit).toBe(all.collected - all.cost - 4000)
  })

  it('agrupa por mes (el más reciente primero) con sus costos secundarios', () => {
    const months = groupFinance(rows, expenses, 'month')
    expect(months.map((m) => m.key)).toEqual(['2027-01', '2026-12', '2026-11'])
    expect(months.find((m) => m.key === '2026-11')).toMatchObject({ orders: 1, extra: 3000 })
    expect(months.find((m) => m.key === '2027-01')).toMatchObject({ orders: 1, extra: 1000 })
  })

  it('agrupa por año', () => {
    const years = groupFinance(rows, expenses, 'year')
    expect(years.map((y) => [y.key, y.orders, y.extra])).toEqual([
      ['2027', 1, 1000],
      ['2026', 2, 3000],
    ])
  })

  it('un costo secundario de un mes sin pedidos aparece igual', () => {
    const months = groupFinance(
      [],
      [{ description: 'x', amount: 500, date: new Date(2026, 2, 1) }],
      'month',
    )
    expect(months).toHaveLength(1)
    expect(months[0]).toMatchObject({ key: '2026-03', orders: 0, extra: 500, profit: -500 })
  })

  it('periodKey usa la fecha local', () => {
    expect(periodKey(new Date(2026, 0, 31, 23, 30).getTime(), 'month')).toBe('2026-01')
  })
})

describe('costo secundario', () => {
  const ok = { description: 'Bolsas', amount: 3000, date: Date.now() }

  it('acepta uno válido', () => {
    expect(validateExpense(ok)).toBe('')
  })

  it('exige descripción, monto entero positivo y fecha', () => {
    expect(validateExpense({ ...ok, description: ' ' })).toMatch(/qué compraste/)
    expect(validateExpense({ ...ok, amount: 0 })).toMatch(/mayor que 0/)
    expect(validateExpense({ ...ok, amount: 10.5 })).toMatch(/mayor que 0/)
    expect(validateExpense({ ...ok, date: null })).toMatch(/fecha/)
  })
})
