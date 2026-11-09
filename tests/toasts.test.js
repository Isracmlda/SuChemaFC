import { describe, expect, it } from 'vitest'
import { TOAST_MAX, dropToast, pushToast, toastDuration } from '../src/utils/toasts.js'

describe('pushToast', () => {
  it('agrega al final conservando el orden', () => {
    const list = pushToast([], { type: 'ok', text: 'A' }, 1)
    const next = pushToast(list, { type: 'error', text: 'B' }, 2)
    expect(next.map((t) => t.id)).toEqual([1, 2])
  })

  it('reemplaza un toast igual (mismo tipo y texto) en vez de apilarlo', () => {
    let list = pushToast([], { type: 'ok', text: 'A' }, 1)
    list = pushToast(list, { type: 'ok', text: 'B' }, 2)
    list = pushToast(list, { type: 'ok', text: 'A' }, 3)
    expect(list.map((t) => [t.text, t.id])).toEqual([
      ['B', 2],
      ['A', 3],
    ])
  })

  it('el mismo texto con otro tipo no cuenta como repetido', () => {
    let list = pushToast([], { type: 'ok', text: 'A' }, 1)
    list = pushToast(list, { type: 'error', text: 'A' }, 2)
    expect(list).toHaveLength(2)
  })

  it('descarta los más viejos al pasar el máximo', () => {
    let list = []
    for (let i = 1; i <= TOAST_MAX + 2; i += 1) {
      list = pushToast(list, { type: 'ok', text: `T${i}` }, i)
    }
    expect(list).toHaveLength(TOAST_MAX)
    expect(list[0].id).toBe(3)
    expect(list.at(-1).id).toBe(TOAST_MAX + 2)
  })

  it('no modifica la lista original', () => {
    const list = [{ id: 1, type: 'ok', text: 'A' }]
    pushToast(list, { type: 'ok', text: 'B' }, 2)
    expect(list).toHaveLength(1)
  })
})

describe('dropToast', () => {
  it('quita solo el toast con ese id', () => {
    const list = [
      { id: 1, type: 'ok', text: 'A' },
      { id: 2, type: 'ok', text: 'B' },
    ]
    expect(dropToast(list, 1).map((t) => t.id)).toEqual([2])
    expect(dropToast(list, 9)).toHaveLength(2)
  })
})

describe('toastDuration', () => {
  it('los errores duran más que los éxitos', () => {
    expect(toastDuration('error')).toBeGreaterThan(toastDuration('ok'))
  })

  it('un tipo desconocido usa la duración de éxito', () => {
    expect(toastDuration('otro')).toBe(toastDuration('ok'))
  })
})
