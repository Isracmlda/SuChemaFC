import { useEffect } from 'react'
import { MdContentCopy, MdWhatsapp } from 'react-icons/md'
import { Link } from 'react-router-dom'
import {
  SHIPPING_METHODS,
  buildWhatsAppMessage,
  orderRef,
  trackingUrl,
  whatsappLink,
} from './checkout.js'
import { useDialog } from '../../hooks/useDialog.js'
import { useToast } from '../../hooks/useToast.js'
import { formatCRC } from '../../utils/format.js'
import { saveOrderCode } from '../tracking/savedOrders.js'
import { trackingLabel } from '../tracking/tracking.js'
import {
  actionRowClass,
  actionStackClass,
  btnPrimary,
  btnSecondary,
  cardClass,
} from '../../utils/ui.js'

/** Pantalla final: código del pedido, enlace de rastreo y botón de WhatsApp con el resumen. */
export default function OrderConfirmation({ result, whatsappNumber }) {
  const dialog = useDialog()
  const toast = useToast()
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

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text)
      toast.ok(`${what === 'código' ? 'Código' : 'Enlace'} copiado.`)
    } catch {
      await dialog.showText({ title: 'Copiar texto', message: 'Copia este texto:', text })
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
        <div className={actionRowClass}>
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

      <div className={actionStackClass}>
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
