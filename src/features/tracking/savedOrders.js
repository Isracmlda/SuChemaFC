import { MAX_SAVED, SAVED_KEY, parseSaved, removeSaved, upsertSaved } from './tracking.js'

function read() {
  try {
    return parseSaved(localStorage.getItem(SAVED_KEY) ?? '[]')
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, MAX_SAVED)))
  } catch {
    // Sin almacenamiento (modo privado o lleno): el código igual se puede copiar y guardar a mano.
  }
  return list
}

export const loadSavedOrders = read

/** Guarda el código de un pedido en este dispositivo. Devuelve la lista actualizada. */
export const saveOrderCode = (code, label = '') =>
  write(upsertSaved(read(), { code, label, at: Date.now() }))

export const forgetOrderCode = (code) => write(removeSaved(read(), code))
