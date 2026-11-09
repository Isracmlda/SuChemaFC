import { describe, expect, it } from 'vitest'
import {
  assignedLines,
  buildCsv,
  buildSupplierOrder,
  csvCell,
  customerNotices,
  DEFAULT_MESSAGE,
  defaultEstimate,
  defaultUnitCost,
  filterPending,
  fillTemplate,
  groupLines,
  orderStatusAfterRemoval,
  orderStatusFor,
  pendingLines,
  validateSupplierForm,
} from '../src/features/admin/supplier/supplier.js'

const line = (name, size, qty = 1, extra = {}) => ({
  productId: name.toLowerCase(),
  name,
  size,
  qty,
  unitPrice: 20000,
  patches: [],
  custom: null,
  ...extra,
})

const order = (id, lines, extra = {}) => ({
  id,
  trackingCode: id.padEnd(32, 'x'),
  customer: { name: `Cliente ${id}`, phone: '88888888' },
  status: 'adelanto_confirmado',
  deleted: false,
  lines,
  ...extra,
})

const orders = [
  order('AAAA1111', [line('Real', 'M'), line('Barca', 'L', 2)]),
  order('BBBB2222', [line('Real', 'M')]),
  order('CCCC3333', [line('Real', 'S')], { status: 'pago_pendiente_revision' }),
  order('DDDD4444', [line('Real', 'S')], { deleted: true }),
]

describe('líneas pendientes', () => {
  it('solo cuenta pedidos con adelanto confirmado y no cancelados', () => {
    const lines = pendingLines(orders, [])
    expect(lines.map((l) => l.key)).toEqual(['AAAA1111:0', 'AAAA1111:1', 'BBBB2222:0'])
  })

  it('excluye líneas que ya están en un pedido a proveedor', () => {
    const so = { status: 'pedido', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 0 }] }
    expect(pendingLines(orders, [so]).map((l) => l.key)).toEqual(['AAAA1111:1', 'BBBB2222:0'])
    expect(assignedLines([so]).get('AAAA1111:0')).toBe('pedido')
  })

  it('agrupa por camisa y talla y filtra', () => {
    const lines = pendingLines(orders, [])
    expect(groupLines(lines)).toEqual([
      { key: 'barca|L', productId: 'barca', variantId: null, name: 'Barca', size: 'L', qty: 2 },
      { key: 'real|M', productId: 'real', variantId: null, name: 'Real', size: 'M', qty: 2 },
    ])
    expect(filterPending(lines, { size: 'L' })).toHaveLength(1)
    expect(filterPending(lines, { query: 'cliente bbbb' })).toHaveLength(1)
  })

  describe('con versiones', () => {
    const versioned = [
      order('VVVV0001', [
        line('Real · Hombre', 'M', 1, { productId: 'real', variantId: 'hombre' }),
        line('Real · Mujer', 'M', 2, { productId: 'real', variantId: 'mujer' }),
        line('Real', 'M', 1, { productId: 'real' }),
      ]),
      order('VVVV0002', [line('Real · Mujer', 'M', 1, { productId: 'real', variantId: 'mujer' })]),
    ]

    it('las líneas pendientes incluyen variantId (null si no hay)', () => {
      const lines = pendingLines(versioned, [])
      expect(lines.map((l) => l.variantId)).toEqual(['hombre', 'mujer', null, 'mujer'])
    })

    it('no mezcla versiones con la misma talla y suma la misma versión', () => {
      const groups = groupLines(pendingLines(versioned, []))
      expect(groups).toHaveLength(3)
      expect(groups.map((g) => [g.name, g.variantId, g.qty])).toEqual([
        ['Real', null, 1],
        ['Real · Hombre', 'hombre', 1],
        ['Real · Mujer', 'mujer', 3],
      ])
    })

    it('el costo propuesto usa el de la versión y, si no hay, el de la camisa', () => {
      const costs = { real: 12000 }
      const variantCosts = { real: { mujer: 9000 } }
      expect(defaultUnitCost({ productId: 'real', variantId: 'mujer' }, costs, variantCosts)).toBe(
        9000,
      )
      expect(defaultUnitCost({ productId: 'real', variantId: 'hombre' }, costs, variantCosts)).toBe(
        12000,
      )
      expect(defaultUnitCost({ productId: 'real', variantId: null }, costs, variantCosts)).toBe(
        12000,
      )
      expect(defaultUnitCost({ productId: 'otra', variantId: null }, costs)).toBe(0)
    })
  })
})

describe('formulario del pedido a proveedor', () => {
  const lines = pendingLines(orders, []).map((l) => ({ ...l, unitCost: 8000 }))
  const ok = { supplier: 'Kitmm', notes: '', estimatedDate: defaultEstimate(), lines }

  it('acepta un formulario válido', () => {
    expect(validateSupplierForm(ok)).toBe('')
  })

  it('rechaza proveedor vacío, sin líneas, costos inválidos y fecha pasada', () => {
    expect(validateSupplierForm({ ...ok, supplier: ' ' })).toMatch(/proveedor/)
    expect(validateSupplierForm({ ...ok, lines: [] })).toMatch(/al menos una/)
    expect(validateSupplierForm({ ...ok, lines: [{ ...lines[0], unitCost: -1 }] })).toMatch(/costo/)
    expect(validateSupplierForm({ ...ok, estimatedDate: Date.now() - 10 * 86_400_000 })).toMatch(
      /pasada/,
    )
  })

  it('arma el documento con costo total y referencias a las líneas', () => {
    const doc = buildSupplierOrder(ok)
    expect(doc.status).toBe('pedido')
    expect(doc.lineRefs).toHaveLength(3)
    expect(doc.totalCost).toBe(4 * 8000)
    expect(doc.items[1]).toMatchObject({ name: 'Barca', qty: 2, unitCost: 8000 })
  })
})

describe('estado de los pedidos de clientes', () => {
  const full = (status) => ({
    status,
    lineRefs: [
      { orderId: 'AAAA1111', lineIndex: 0 },
      { orderId: 'AAAA1111', lineIndex: 1 },
      { orderId: 'BBBB2222', lineIndex: 0 },
    ],
  })

  it('avanza solo cuando TODAS las camisas están en pedidos a proveedor', () => {
    const partial = { status: 'pedido', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 0 }] }
    expect(orderStatusFor(orders[0], [partial])).toBeNull()
    expect(orderStatusFor(orders[0], [full('pedido')])).toBe('pedido_al_proveedor')
  })

  it('sigue el avance del proveedor: enviado y llegó', () => {
    expect(orderStatusFor(orders[1], [full('enviado')])).toBe('en_camino')
    expect(orderStatusFor(orders[1], [full('llego')])).toBe('listo_para_entrega')
  })

  it('con camisas en varios pedidos se queda en la etapa más atrasada', () => {
    const a = { status: 'llego', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 0 }] }
    const b = { status: 'pedido', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 1 }] }
    expect(orderStatusFor(orders[0], [a, b])).toBe('pedido_al_proveedor')
  })

  it('no cambia si ya está en ese estado ni toca pedidos sin adelanto o cancelados', () => {
    expect(orderStatusFor({ ...orders[1], status: 'en_camino' }, [full('enviado')])).toBeNull()
    expect(orderStatusFor(orders[2], [full('pedido')])).toBeNull()
    expect(orderStatusFor(orders[3], [full('pedido')])).toBeNull()
  })

  it('no retrocede un pedido entregado', () => {
    expect(orderStatusFor({ ...orders[1], status: 'entregado' }, [full('pedido')])).toBeNull()
  })
})

describe('eliminar un pedido a proveedor', () => {
  const partial = { status: 'pedido', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 0 }] }
  const other = { status: 'pedido', lineRefs: [{ orderId: 'AAAA1111', lineIndex: 1 }] }

  it('el pedido de cliente vuelve a adelanto confirmado si queda una camisa sin pedir', () => {
    const sent = { ...orders[0], status: 'pedido_al_proveedor' }
    expect(orderStatusAfterRemoval(sent, [partial])).toBe('adelanto_confirmado')
    expect(orderStatusAfterRemoval(sent, [])).toBe('adelanto_confirmado')
  })

  it('si todas sus camisas siguen pedidas, toma la etapa que corresponde', () => {
    const sent = { ...orders[0], status: 'listo_para_entrega' }
    expect(orderStatusAfterRemoval(sent, [partial, other])).toBe('pedido_al_proveedor')
  })

  it('no cambia lo que ya está en adelanto confirmado, cancelado o entregado', () => {
    expect(orderStatusAfterRemoval(orders[0], [])).toBeNull()
    expect(orderStatusAfterRemoval(orders[3], [])).toBeNull()
    expect(orderStatusAfterRemoval({ ...orders[0], status: 'entregado' }, [])).toBeNull()
  })
})

describe('CSV', () => {
  it('escapa comillas y neutraliza fórmulas', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('=SUMA(A1)')).toBe('"\'=SUMA(A1)"')
    expect(csvCell(null)).toBe('""')
  })

  it('incluye encabezado, filas y total con BOM', () => {
    const so = buildSupplierOrder({
      supplier: 'X',
      notes: '',
      estimatedDate: null,
      lines: [{ ...pendingLines(orders, [])[1], unitCost: 5000 }],
    })
    const csv = buildCsv(so)
    expect(csv.startsWith('\uFEFF"Pedido"')).toBe(true)
    expect(csv).toContain('"Barca","L"')
    expect(csv).toContain('"Total","10000"')
    expect(csv.split('\r\n')).toHaveLength(4)
  })

  it('incluye la competición del nombre y número', () => {
    const line = {
      ...pendingLines(orders, [])[1],
      custom: { name: 'LEO', number: '10', competition: 'Champions' },
      unitCost: 5000,
    }
    const so = buildSupplierOrder({ supplier: 'X', notes: '', estimatedDate: null, lines: [line] })
    expect(so.items[0].custom.competition).toBe('Champions')
    const csv = buildCsv(so)
    expect(csv).toContain('"Competición"')
    expect(csv).toContain('"LEO","10","Champions"')
  })
})

describe('avisos por WhatsApp', () => {
  it('sustituye las variables conocidas y deja las otras', () => {
    expect(fillTemplate('Hola {nombre} {x}', { nombre: 'Ana' })).toBe('Hola Ana {x}')
  })

  it('genera un enlace por cliente con fecha y enlace de rastreo', () => {
    const so = { status: 'enviado', estimatedDate: new Date(2026, 11, 20).getTime() }
    const [n] = customerNotices([orders[0]], so, {
      template: DEFAULT_MESSAGE,
      origin: 'https://x.test',
    })
    expect(n.link).toMatch(/^https:\/\/wa\.me\/50688888888\?text=/)
    const text = decodeURIComponent(n.link.split('text=')[1])
    expect(text).toContain('Cliente AAAA1111')
    expect(text).toContain('enviado')
    expect(text).toContain('puede cambiar')
    expect(text).toContain('https://x.test/?pedido=')
  })
})
