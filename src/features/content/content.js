import { formatCRC } from '../../utils/format.js'

/** Contenido informativo editable desde el admin (se guarda en settings/content). */

export const MAX_TEXT = 5000
export const MAX_FAQ = 30
export const MAX_QUESTION = 200
export const MAX_ANSWER = 1500
export const MAX_WA_MESSAGE = 300
export const DEFAULT_LEAD_DAYS = 30
export const DEFAULT_WA_MESSAGE = 'Hola SuChemaFC, tengo una consulta.'

/** Textos iniciales. Admiten {adelanto}, {plazo} y {tarifa}, que salen de los ajustes. */
export const DEFAULT_CONTENT = {
  howToBuy: [
    '1. Elegí tus camisetas en el catálogo y agregalas al carrito (o guardalas en tu lista de deseos).',
    '2. Indicá talla, parches y personalización si la querés.',
    '3. En el carrito, revisá el resumen y continuá al pago.',
    '4. Pagá el adelanto del {adelanto} por SINPE y subí el comprobante.',
    '5. Revisamos tu comprobante y confirmamos el adelanto.',
    '6. Hacemos el pedido al proveedor y te avisamos cuando esté listo (aprox. {plazo}).',
    '7. Pagás el saldo contra entrega, por SINPE o en efectivo.',
  ].join('\n'),
  faq: [
    {
      q: '¿Por qué piden un adelanto?',
      a: 'Las camisetas se piden por encargo. El adelanto del {adelanto} confirma tu pedido y el saldo se paga al recibirlo.',
    },
    {
      q: '¿Cuánto tarda mi pedido?',
      a: 'El plazo aproximado es de {plazo} desde que confirmamos el adelanto. La fecha puede cambiar; podés seguirla en Rastreo.',
    },
    {
      q: '¿Necesito una cuenta para comprar?',
      a: 'No. Podés comprar como invitado o ingresar con Google para ver tu historial de pedidos.',
    },
    {
      q: '¿Cómo sigo mi pedido?',
      a: 'Entrá a Rastreo con el código de tu pedido, o a Mis pedidos si ingresaste con Google.',
    },
  ],
  shipping:
    'Enviamos por Correos de Costa Rica ({tarifa}), o coordinamos la entrega por WhatsApp. Elegís la opción al finalizar la compra.',
  returns:
    'Como cada camiseta se pide por encargo, revisá bien la talla y la guía de tallas antes de comprar.\n\n- Si tu camiseta llega con un defecto de fábrica o no es la que pediste, escribinos por WhatsApp el mismo día de la entrega.\n- Las camisetas personalizadas (nombre o número) no tienen cambio, salvo error nuestro.',
  terms:
    'Al comprar en SuChemaFC aceptás que:\n\n- El pedido se confirma al revisar tu adelanto del {adelanto}.\n- El plazo de entrega es aproximado ({plazo}) y puede cambiar por el proveedor.\n- El saldo se paga al recibir tu pedido.',
  whatsappMessage: DEFAULT_WA_MESSAGE,
  leadDays: DEFAULT_LEAD_DAYS,
}

const isText = (v) => typeof v === 'string'

/** Mezcla el documento guardado con los textos iniciales. Lo inválido se ignora. */
export function normalizeContent(doc) {
  const d = doc ?? {}
  const faq = Array.isArray(d.faq)
    ? d.faq.filter((f) => f && isText(f.q) && isText(f.a) && f.q.trim() && f.a.trim())
    : DEFAULT_CONTENT.faq
  const text = (key) => (isText(d[key]) ? d[key] : DEFAULT_CONTENT[key])
  return {
    howToBuy: text('howToBuy'),
    faq,
    shipping: text('shipping'),
    returns: text('returns'),
    terms: text('terms'),
    whatsappMessage:
      isText(d.whatsappMessage) && d.whatsappMessage.trim()
        ? d.whatsappMessage
        : DEFAULT_WA_MESSAGE,
    leadDays: Number.isInteger(d.leadDays) && d.leadDays > 0 ? d.leadDays : DEFAULT_LEAD_DAYS,
  }
}

/** Valores para los marcadores, a partir de los ajustes de la tienda. */
export function templateVars({ advancePercent, correosFee, leadDays }) {
  return {
    adelanto: `${advancePercent}%`,
    plazo: `${leadDays} días`,
    tarifa: correosFee > 0 ? `tarifa extra de ${formatCRC(correosFee)}` : 'sin costo extra',
  }
}

/** Reemplaza {nombre} por su valor. Los marcadores desconocidos se dejan como están. */
export const fillTemplate = (text, vars) =>
  String(text ?? '').replace(/\{(\w+)\}/g, (all, key) => vars[key] ?? all)

/**
 * Convierte el texto simple en bloques:
 * "## Título", listas con "- " o "1. ", y párrafos separados por línea en blanco.
 */
export function parseBlocks(text) {
  const blocks = []
  let current = null
  const flush = () => {
    if (current) blocks.push(current)
    current = null
  }
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const heading = /^##\s+(.+)$/.exec(line)
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: 'h', text: heading[1] })
    } else if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol'
      if (current?.type !== type) {
        flush()
        current = { type, items: [] }
      }
      current.items.push((bullet ?? numbered)[1])
    } else {
      if (current?.type !== 'p') {
        flush()
        current = { type: 'p', lines: [] }
      }
      current.lines.push(line)
    }
  }
  flush()
  return blocks.map((b) => (b.type === 'p' ? { type: 'p', text: b.lines.join(' ') } : b))
}

/** Trozos de un texto en línea: [{ text, bold }] con **negrita**. */
export function parseInline(text) {
  return String(text)
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text)
}

/** Texto con el primer problema del formulario de contenido, o '' si es válido. */
export function validateContent(c) {
  for (const [key, label] of [
    ['howToBuy', 'Cómo comprar'],
    ['shipping', 'Envíos y entrega'],
    ['returns', 'Cambios y devoluciones'],
    ['terms', 'Términos y condiciones'],
  ]) {
    if (c[key].length > MAX_TEXT) return `"${label}" supera los ${MAX_TEXT} caracteres.`
  }
  if (c.faq.length > MAX_FAQ) return `Máximo ${MAX_FAQ} preguntas frecuentes.`
  for (const [i, f] of c.faq.entries()) {
    if (!f.q.trim() || !f.a.trim()) return `La pregunta ${i + 1} debe tener pregunta y respuesta.`
    if (f.q.length > MAX_QUESTION)
      return `La pregunta ${i + 1} supera los ${MAX_QUESTION} caracteres.`
    if (f.a.length > MAX_ANSWER) return `La respuesta ${i + 1} supera los ${MAX_ANSWER} caracteres.`
  }
  if (!c.whatsappMessage.trim()) return 'Escribe el mensaje inicial de WhatsApp.'
  if (c.whatsappMessage.length > MAX_WA_MESSAGE) {
    return `El mensaje de WhatsApp supera los ${MAX_WA_MESSAGE} caracteres.`
  }
  if (!Number.isInteger(c.leadDays) || c.leadDays < 1 || c.leadDays > 365) {
    return 'El plazo debe ser un número entero de días entre 1 y 365.'
  }
  return ''
}

/** Documento a guardar en settings/content. */
export const buildContentDoc = (c) => ({
  howToBuy: c.howToBuy.trim(),
  faq: c.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
  shipping: c.shipping.trim(),
  returns: c.returns.trim(),
  terms: c.terms.trim(),
  whatsappMessage: c.whatsappMessage.trim(),
  leadDays: c.leadDays,
})
