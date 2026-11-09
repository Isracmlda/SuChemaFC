import { formatCRC } from '../../utils/format.js'

export const DEFAULT_SHIPPING = {
  correosEnabled: true,
  correosFee: 0,
  correosText:
    'Enviamos por Correos de Costa Rica. Te avisaremos por WhatsApp con el número de guía cuando salga tu pedido.',
  whatsappEnabled: true,
  whatsappText: 'Coordinamos la entrega contigo por WhatsApp una vez confirmado tu adelanto.',
}

export const PAYMENT_TYPES = [{ value: 'sinpe', label: 'SINPE Móvil' }]

export const isPercent = (v) => Number.isInteger(v) && v >= 1 && v <= 100

/**
 * Ajustes de la tienda para el checkout a partir de los documentos de Firestore.
 * `ready` es false si falta `settings/payment.advancePercent`: sin él las reglas rechazan todo pedido.
 */
export function normalizeCheckoutSettings({ payment, shipping, general }, methods = []) {
  return {
    ready: isPercent(payment?.advancePercent),
    advancePercent: isPercent(payment?.advancePercent) ? payment.advancePercent : 50,
    shipping: { ...DEFAULT_SHIPPING, ...shipping },
    whatsappNumber: general?.whatsappNumber ?? '',
    methods: methods
      .filter((m) => m.visible !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  }
}

/** Formas de entrega activas, en el orden en que se ofrecen. */
export function enabledMethods(shipping) {
  return [
    ...(shipping.correosEnabled ? ['correos'] : []),
    ...(shipping.whatsappEnabled ? ['whatsapp'] : []),
  ]
}

/** Texto con el primer problema de los ajustes del admin, o '' si son válidos. */
export function validateSettingsForm({ advancePercent, shipping, whatsappNumber }) {
  if (!isPercent(advancePercent)) return 'El adelanto debe ser un porcentaje entero entre 1 y 100.'
  if (!Number.isInteger(shipping.correosFee) || shipping.correosFee < 0) {
    return 'La tarifa de Correos no es válida.'
  }
  if (!shipping.correosEnabled && !shipping.whatsappEnabled) {
    return 'Deja activa al menos una forma de entrega.'
  }
  const digits = String(whatsappNumber).replace(/\D/g, '')
  if (digits && (digits.length < 8 || digits.length > 15)) {
    return 'El número de WhatsApp debe tener entre 8 y 15 dígitos.'
  }
  return ''
}

export function validateMethod(m) {
  if (!m.number.trim()) return 'Escribe el número o cuenta.'
  if (!m.holder.trim()) return 'Escribe el nombre del titular.'
  return ''
}

export const describeFee = (fee) => (fee > 0 ? `+${formatCRC(fee)}` : 'sin costo extra')
