import { describe, expect, it } from 'vitest'
import {
  MAX_SAVED,
  buildStages,
  normalizeTracking,
  orderBalance,
  parseSaved,
  parseTrackingCode,
  removeSaved,
  showsEstimate,
  sortHistory,
  sortOrdersByDate,
  trackingLabel,
  upsertSaved,
} from '../src/features/tracking/tracking.js'

const CODE = 'ab12'.repeat(8) // 32 caracteres, como los que genera el checkout

describe('código de rastreo', () => {
  it('acepta el código solo, con espacios o dentro de un enlace', () => {
    expect(parseTrackingCode(CODE)).toBe(CODE)
    expect(parseTrackingCode(`  ${CODE}\n`)).toBe(CODE)
    expect(parseTrackingCode(`https://suchemafc.web.app/?pedido=${CODE}`)).toBe(CODE)
    expect(parseTrackingCode(`/rastreo?x=1&pedido=${CODE}&y=2`)).toBe(CODE)
  })

  it('rechaza lo corto, lo largo y los caracteres raros', () => {
    expect(parseTrackingCode('')).toBe('')
    expect(parseTrackingCode('abc123')).toBe('')
    expect(parseTrackingCode('a'.repeat(65))).toBe('')
    expect(parseTrackingCode(`${CODE}/../x`)).toBe('')
    expect(parseTrackingCode(undefined)).toBe('')
  })
})

describe('etapas', () => {
  it('marca hechas, la actual y las pendientes', () => {
    const stages = buildStages('en_camino')
    expect(stages.map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'pending',
      'pending',
    ])
  })

  it('entregado deja todo completado', () => {
    expect(buildStages('entregado').every((s) => s.state === 'done')).toBe(true)
  })

  it('un pedido cancelado no tiene etapas', () => {
    expect(buildStages('cancelado')).toEqual([])
  })

  it('con el pago rechazado la primera etapa queda con problema', () => {
    const stages = buildStages('pago_rechazado')
    expect(stages[0]).toMatchObject({ state: 'current', problem: true })
    expect(stages[1].state).toBe('pending')
  })
})

describe('historial y fechas', () => {
  it('ordena del más reciente al más antiguo y deja sin hora al final', () => {
    const list = sortHistory([{ at: 1 }, { at: 3 }, { at: null }, { at: 2 }])
    expect(list.map((e) => e.at)).toEqual([3, 2, 1, null])
  })

  it('normaliza fechas de Firestore a milisegundos', () => {
    const ts = (ms) => ({ toMillis: () => ms })
    const t = normalizeTracking(CODE, {
      status: 'en_camino',
      estimatedDate: ts(50),
      updatedAt: ts(60),
      summary: [{ name: 'A', size: 'M', qty: 1 }],
      timeline: [{ status: 'en_camino', at: ts(40) }],
    })
    expect(t).toMatchObject({ estimatedDate: 50, updatedAt: 60 })
    expect(t.timeline).toEqual([{ status: 'en_camino', at: 40, note: '' }])
  })

  it('muestra la fecha estimada solo si existe y el pedido sigue en curso', () => {
    expect(showsEstimate({ estimatedDate: 5, status: 'en_camino' })).toBe(true)
    expect(showsEstimate({ estimatedDate: null, status: 'en_camino' })).toBe(false)
    expect(showsEstimate({ estimatedDate: 5, status: 'entregado' })).toBe(false)
    expect(showsEstimate({ estimatedDate: 5, status: 'cancelado' })).toBe(false)
  })
})

describe('pedidos guardados en el dispositivo', () => {
  it('ignora JSON dañado o con códigos inválidos', () => {
    expect(parseSaved('no es json')).toEqual([])
    expect(parseSaved('{"a":1}')).toEqual([])
    expect(
      parseSaved(JSON.stringify([{ code: 'corto' }, { code: CODE, label: 'X', at: 5 }])),
    ).toEqual([{ code: CODE, label: 'X', at: 5 }])
  })

  it('agrega primero, no duplica y conserva la etiqueta y la fecha originales', () => {
    const first = upsertSaved([], { code: CODE, label: 'Real', at: 1 })
    const other = upsertSaved(first, { code: 'z'.repeat(32), label: 'Barca', at: 2 })
    expect(other.map((x) => x.label)).toEqual(['Barca', 'Real'])
    const again = upsertSaved(other, { code: CODE, at: 9 })
    expect(again[0]).toEqual({ code: CODE, label: 'Real', at: 1 })
    expect(again).toHaveLength(2)
  })

  it('limita la cantidad y permite olvidar', () => {
    let list = []
    for (let i = 0; i < MAX_SAVED + 5; i += 1) {
      list = upsertSaved(list, { code: String(i).padStart(24, 'c'), at: i })
    }
    expect(list).toHaveLength(MAX_SAVED)
    expect(removeSaved(list, list[0].code)).toHaveLength(MAX_SAVED - 1)
  })

  it('etiqueta con la primera camisa y cuántas más hay', () => {
    expect(trackingLabel([])).toBe('')
    expect(trackingLabel([{ name: 'Real' }])).toBe('Real')
    expect(trackingLabel([{ name: 'Real' }, { name: 'Barca' }, { name: 'Inter' }])).toBe(
      'Real y 2 más',
    )
  })
})

describe('mis pedidos', () => {
  const ts = (ms) => ({ toMillis: () => ms })

  it('ordena del más reciente al más antiguo', () => {
    const list = sortOrdersByDate([
      { id: 'a', createdAt: ts(1) },
      { id: 'b', createdAt: ts(3) },
      { id: 'c', createdAt: ts(2) },
    ])
    expect(list.map((o) => o.id)).toEqual(['b', 'c', 'a'])
  })

  it('calcula el saldo con lo pagado registrado', () => {
    expect(orderBalance({ total: 40000, paidAmount: 20000 })).toBe(20000)
    expect(orderBalance({ total: 40000 })).toBe(40000)
    expect(orderBalance({ total: 40000, paidAmount: 50000 })).toBe(0)
  })
})
