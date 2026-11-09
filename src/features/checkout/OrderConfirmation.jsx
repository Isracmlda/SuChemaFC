import { useEffect, useState } from 'react'
import { MdContentCopy, MdWhatsapp } from 'react-icons/md'
import { Link } from 'react-router-dom'
import {
  SHIPPING_METHODS,
  buildWhatsAppMessage,
  orderRef,
  trackingUrl,
  whatsappLink,
} from './checkout.js'
import { formatCRC } from '../../utils/format.js'
import { saveOrderCode } from '../tracking/savedOrders.js'
import { trackingLabel } from '../tracking/tracking.js'
import { btnPrimary, btnSecondary, cardClass } from '../../utils/ui.js'

/** Pantalla final: código del pedido, enlace de rastreo y botón de WhatsApp con el resumen. */
export default function OrderConfirmation({ result, whatsappNumber }) {
  const [copied, setCopied] = useState('')
  const link = trackingUrl(window.location.origin, result.trackingCode)
  const wa = whatsappLink(
    whatsappNumber,
    buildWhatsAppMessage({
      customerName: result.customerName,
      code: result.trackingCode,
      link,
      lines: result.lines,
      totals: result.totals,
      method: result.method,
    }),
  )

  // Guarda el código en este dispositivo para poder consultarlo después en /rastreo.
  useEffect(() => {
    saveOrderCode(result.trackingCode, trackingLabel(result.lines))
  }, [result.trackingCode, result.lines])

  useEffect(() => {
    if (!copied) return undefined
    const id = setTimeout(() => setCopied(''), 2500)
    return () => clearTimeout(id)
  }, [copied])

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      setCopied('')
      window.prompt('Copia este texto:', text)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="done-title">
      <div>
        <h1 id="done-title" className="text-2xl font-bold">
          ¡Pedido recibido!
        </h1>
        <p className="text-muted">
          Referencia <strong className="text-fg">{orderRef(result.orderId)}</strong>. Revisaremos tu
          comprobante y te confirmaremos el adelanto.
        </p>
      </div>

      <div className={`${cardClass} flex flex-col gap-3`}>
        <p className="font-semibold">Guarda tu código de rastreo</p>
        <p className="break-all rounded-md bg-surface-2 p-3 font-mono text-sm">
          {result.trackingCode}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(result.trackingCode, 'código')}
            className={btnSecondary}
          >
            <MdContentCopy className="size-5" aria-hidden="true" />
            Copiar código
          </button>
          <button type="button" onClick={() => copy(link, 'enlace')} className={btnSecondary}>
            <MdContentCopy className="size-5" aria-hidden="true" />
            Copiar enlace
          </button>
        </div>
        <p role="status" className="min-h-5 text-sm text-success">
          {copied && `✓ ${copied === 'código' ? 'Código' : 'Enlace'} copiado.`}
        </p>
        <p className="text-sm text-muted">
          Con este código sigues tu pedido sin necesidad de cuenta. Si lo pierdes, no podremos
          mostrártelo de nuevo.
        </p>
      </div>

      <div className={`${cardClass} flex flex-col gap-1 text-sm`}>
        <p>
          <span className="text-muted">Total:</span> {formatCRC(result.totals.total)}
        </p>
        <p>
          <span className="text-muted">Adelanto enviado:</span>{' '}
          {formatCRC(result.totals.advanceRequired)}
        </p>
        <p>
          <span className="text-muted">Entrega:</span> {SHIPPING_METHODS[result.method]}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            <MdWhatsapp className="size-5" aria-hidden="true" />
            Enviar resumen por WhatsApp
          </a>
        )}
        <Link to="/" className={btnSecondary}>
          Seguir comprando
        </Link>
      </div>
      {!wa && (
        <p className="text-sm text-muted">
          El WhatsApp de la tienda aún no está configurado: guarda tu código para consultar tu
          pedido.
        </p>
      )}
    </section>
  )
}
