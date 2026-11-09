/**
 * Cola de notificaciones toast. Funciones puras: el componente solo las aplica a su estado.
 * Tipos: 'ok' (éxito) y 'error'.
 */

export const TOAST_MAX = 4 // toasts visibles a la vez; al llegar otro se descarta el más viejo
export const TOAST_MS = { ok: 4000, error: 8000 } // los errores duran más para poder leerlos

export const toastDuration = (type) => TOAST_MS[type] ?? TOAST_MS.ok

const keyOf = (toast) => `${toast.type}|${toast.text}`

/**
 * Agrega un toast al final. Si ya hay uno igual (mismo tipo y texto) se reemplaza por el nuevo en
 * lugar de apilar copias; así repetir una acción reinicia su cuenta regresiva.
 */
export function pushToast(list, toast, id, max = TOAST_MAX) {
  const rest = list.filter((t) => keyOf(t) !== keyOf(toast))
  return [...rest, { ...toast, id }].slice(-max)
}

export const dropToast = (list, id) => list.filter((t) => t.id !== id)
