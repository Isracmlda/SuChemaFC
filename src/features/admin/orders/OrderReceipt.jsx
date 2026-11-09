import { useCallback, useEffect, useState } from 'react'
import { MdCheckCircle, MdDownload, MdMail, MdPrint, MdWhatsapp } from 'react-icons/md'
import Collapsible from '../../../components/Collapsible.jsx'
import { Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { printReceipt } from '../../../services/puraPrint.js'
import { errorMessage } from '../../../utils/errors.js'
import { btnPrimary, btnSecondary, cardClass } from '../../../utils/ui.js'
import { orderRef } from '../../checkout/checkout.js'
import { emailReceipt } from '../receipts/receiptActions.js'
import { createReceiptImage, downloadImage } from '../receipts/receiptImage.js'

const FOLLOW_UP_TEXT = {
  drive: {
    working: 'Borrando el comprobante de Drive…',
    ok: 'El comprobante se borró de Drive.',
  },
  mail: {
    working: 'Enviando el correo al cliente con el recibo…',
    ok: 'Se envió el correo al cliente con el recibo.',
    error: 'No se pudo enviar el correo al cliente.',
  },
}

/** Líneas con el avance de lo que sigue a guardar un pago (Drive y correo). */
function followUpLines(follow) {
  return ['drive', 'mail']
    .map((key) => {
      const state = follow[key]
      if (!state || state === 'none') return null
      if (key === 'drive' && state === 'error') {
        return {
          key,
          error: true,
          text: `No se pudo borrar el comprobante de Drive: ${follow.driveError}`,
        }
      }
      return { key, error: state === 'error', text: FOLLOW_UP_TEXT[key][state] }
    })
    .filter(Boolean)
}

/**
 * Recibo del pedido, ya confirmado: una sola sección con la imagen para la impresora térmica de
 * 57 mm (un QR para todo el pedido), que se despliega con animación al aparecer. Desde aquí se
 * imprime con PuraPrint, se descarga, se manda por correo y se avisa al cliente por WhatsApp.
 * `whatsapp` es el enlace wa.me ('' si el teléfono no sirve) y `follow` el avance de Drive y correo.
 */
export default function OrderReceipt({ order, whatsapp, follow }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)

  const load = useCallback(() => createReceiptImage(order), [order])
  const image = useAsync(load)

  // Se abre un instante después de montar para que el despliegue se vea animado.
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 60)
    return () => clearTimeout(timer)
  }, [])

  const ready = Boolean(image.data)
  const lines = follow ? followUpLines(follow) : []

  // Se llama directo desde el clic: PuraPrint se abre dentro del gesto del usuario (si no, el
  // navegador bloquea la ventana).
  function print() {
    setBusy('print')
    setNotice(null)
    printReceipt({
      generate: async () => image.data.dataUrl,
      title: `Recibo ${orderRef(order.id)}`,
      orderId: order.id,
    })
      .then(
        () =>
          setNotice({
            type: 'ok',
            text: 'Recibo enviado a PuraPrint. Conecta la impresora allá para imprimirlo.',
          }),
        (e) => setNotice({ type: 'error', text: errorMessage(e) }),
      )
      .finally(() => setBusy(''))
  }

  function download() {
    downloadImage(image.data)
  }

  async function mail() {
    setBusy('mail')
    setNotice(null)
    const ok = await emailReceipt(order, { image: image.data, resend: true })
    setNotice(
      ok
        ? { type: 'ok', text: 'Recibo enviado por correo al cliente.' }
        : { type: 'error', text: 'No se pudo enviar el correo al cliente.' },
    )
    setBusy('')
  }

  return (
    <Collapsible open={open}>
      <section className={`${cardClass} flex flex-col gap-3`}>
        <h3 className="flex items-center gap-2 font-bold">
          <MdCheckCircle className="size-5 text-success" aria-hidden="true" />
          Recibo
        </h3>

        {image.error && <Notice notice={{ type: 'error', text: errorMessage(image.error) }} />}
        {image.loading && <p className="text-sm text-muted">Preparando el recibo…</p>}
        {ready && (
          <img
            src={image.data.dataUrl}
            alt={`Recibo del pedido ${orderRef(order.id)}`}
            className="card-enter mx-auto w-full max-w-[384px] rounded-md border border-border bg-white"
          />
        )}

        {lines.length > 0 && (
          <ul role="status" className="flex flex-col gap-1 text-sm">
            {lines.map((l) => (
              <li key={l.key} className={l.error ? 'text-danger' : 'text-muted'}>
                {l.text}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button type="button" disabled={!ready || busy} onClick={print} className={btnPrimary}>
            <MdPrint className="size-5" aria-hidden="true" />
            {busy === 'print' ? 'Abriendo…' : 'Imprimir'}
          </button>
          <button type="button" disabled={!ready} onClick={download} className={btnSecondary}>
            <MdDownload className="size-5" aria-hidden="true" />
            Descargar
          </button>
          {order.customer?.email && (
            <button
              type="button"
              disabled={!ready || busy === 'mail'}
              onClick={mail}
              className={btnSecondary}
            >
              <MdMail className="size-5" aria-hidden="true" />
              {busy === 'mail' ? 'Enviando…' : 'Enviar por correo'}
            </button>
          )}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
              <MdWhatsapp className="size-5" aria-hidden="true" />
              Aviso por WhatsApp
            </a>
          ) : (
            <p className="col-span-2 text-sm text-muted">
              El teléfono del cliente no sirve para WhatsApp.
            </p>
          )}
        </div>
        <Notice notice={notice} />
      </section>
    </Collapsible>
  )
}
