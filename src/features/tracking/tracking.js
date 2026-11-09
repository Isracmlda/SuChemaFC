import { toMillis } from '../../utils/dates.js'

/** Etapas visibles para el cliente, en orden (las mismas que los estados de `orders`). */
export const STAGES = [
  { status: 'pago_pendiente_revision', label: 'Pago en revisión' },
  { status: 'adelanto_confirmado', label: 'Adelanto confirmado' },
  { status: 'pedido_al_proveedor', label: 'Pedido al proveedor' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'listo_para_entrega', label: 'Listo para entrega' },
  { status: 'entregado', label: 'Entregado' },
]

const CODE = /^[A-Za-z0-9_-]{20,64}$/

/**
 * Código de rastreo a partir de lo que pegue el cliente: el código solo o el enlace completo
 * (`.../?pedido=CODIGO`). Devuelve '' si no tiene el formato de las reglas (20 a 64 caracteres).
 */
export function parseTrackingCode(input = '') {
  let text = String(input).trim()
  const match = text.match(/[?&]pedido=([^&#\s]+)/i)
  if (match) {
    try {
      text = decodeURIComponent(match[1])
    } catch {
      text = match[1]
    }
  }
  return CODE.test(text) ? text : ''
}

/**
 * Etapas con su estado (`done`, `current`, `pending`). Un pedido cancelado no tiene etapas; con el
 * pago rechazado la primera etapa queda marcada como problema.
 */
export function buildStages(status) {
  if (status === 'cancelado') return []
  const current = status === 'pago_rechazado' ? 0 : STAGES.findIndex((s) => s.status === status)
  return STAGES.map((stage, i) => {
    let state = 'pending'
    if (i < current) state = 'done'
    else if (i === current) state = status === 'entregado' ? 'done' : 'current'
    return { ...stage, state, problem: status === 'pago_rechazado' && i === 0 }
  })
}

/** Historial del más reciente al más antiguo; los eventos sin hora quedan al final. */
export const sortHistory = (timeline = []) =>
  [...timeline].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))

/** El rastreo de Firestore con las fechas en milisegundos. */
export function normalizeTracking(code, data) {
  return {
    code,
    status: data.status,
    estimatedDate: toMillis(data.estimatedDate),
    updatedAt: toMillis(data.updatedAt),
    summary: data.summary ?? [],
    timeline: (data.timeline ?? []).map((e) => ({
      status: e.status,
      at: toMillis(e.at),
      note: e.note ?? '',
    })),
  }
}

/** ¿Tiene sentido mostrar la fecha estimada? No cuando el pedido ya terminó. */
export const showsEstimate = (tracking) =>
  Boolean(tracking.estimatedDate) && !['entregado', 'cancelado'].includes(tracking.status)

// ---------- Pedidos guardados en este dispositivo ----------

export const SAVED_KEY = 'suchema.orders.v1'
export const MAX_SAVED = 20

/** Lista guardada a partir del JSON del almacenamiento; ignora lo dañado. */
export function parseSaved(json) {
  try {
    const value = JSON.parse(json)
    if (!Array.isArray(value)) return []
    return value
      .filter((x) => x && typeof x.code === 'string' && parseTrackingCode(x.code))
      .map((x) => ({ code: x.code, label: String(x.label ?? ''), at: Number(x.at) || 0 }))
      .slice(0, MAX_SAVED)
  } catch {
    return []
  }
}

/** Agrega o actualiza un pedido (queda primero). Conserva la fecha y la etiqueta si ya existía. */
export function upsertSaved(list, { code, label = '', at }) {
  const previous = list.find((x) => x.code === code)
  const entry = { code, label: label || previous?.label || '', at: previous?.at ?? at }
  return [entry, ...list.filter((x) => x.code !== code)].slice(0, MAX_SAVED)
}

export const removeSaved = (list, code) => list.filter((x) => x.code !== code)

/** Nombre corto para reconocer un pedido: la primera camisa y cuántas más hay. */
export function trackingLabel(items = []) {
  if (items.length === 0) return ''
  const first = items[0].name
  return items.length > 1 ? `${first} y ${items.length - 1} más` : first
}

// ---------- Mis pedidos ----------

/** Pedidos del más reciente al más antiguo. */
export const sortOrdersByDate = (orders) =>
  [...orders].sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0))

/** Lo que falta por pagar según lo registrado por el admin. */
export const orderBalance = (order) => Math.max(0, order.total - (order.paidAmount ?? 0))
