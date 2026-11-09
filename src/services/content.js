import { buildContentDoc, normalizeContent, templateVars } from '../features/content/content.js'
import { commitWithAudit } from './audit.js'
import { docRef, getDocDataCached } from './db.js'

/**
 * Lee el contenido informativo y los ajustes que llenan sus marcadores (adelanto, tarifa).
 * Devuelve { content, vars, whatsappNumber }. Los documentos se comparten en caché con el botón
 * de WhatsApp y el checkout, así que visitar Ayuda casi nunca lee nada nuevo.
 */
export async function loadContentBundle() {
  const [content, payment, shipping, general] = await Promise.all([
    getDocDataCached('settings', 'content'),
    getDocDataCached('settings', 'payment'),
    getDocDataCached('settings', 'shipping'),
    getDocDataCached('settings', 'general'),
  ])
  const normalized = normalizeContent(content)
  return {
    content: normalized,
    vars: templateVars({
      advancePercent: payment?.advancePercent ?? 50,
      correosFee: shipping?.correosFee ?? 0,
      leadDays: normalized.leadDays,
    }),
    whatsappNumber: general?.whatsappNumber ?? '',
  }
}

/** Admin: guarda el contenido en settings/content con bitácora (vacía la caché de lecturas). */
export function saveContent(content) {
  return commitWithAudit(
    [{ type: 'set', ref: docRef('settings', 'content'), data: buildContentDoc(content) }],
    {
      action: 'editar',
      collection: 'settings',
      docId: 'content',
      summary: 'Contenido informativo y mensaje de WhatsApp',
    },
  )
}

/**
 * Número y mensaje del botón flotante de WhatsApp. Usa los documentos en caché (5 minutos), así
 * no gasta lecturas en cada visita a una pantalla.
 */
export async function loadWhatsApp() {
  const [general, content] = await Promise.all([
    getDocDataCached('settings', 'general'),
    getDocDataCached('settings', 'content'),
  ])
  return {
    number: general?.whatsappNumber ?? '',
    message: normalizeContent(content).whatsappMessage,
  }
}
