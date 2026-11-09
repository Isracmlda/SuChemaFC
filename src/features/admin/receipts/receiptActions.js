import { notifyPaymentApproved } from '../../../services/notifications.js'
import { createReceiptImage } from './receiptImage.js'

/**
 * Manda el correo de pago aprobado con el recibo (imagen) adjunto. Si el recibo no se pudo armar el
 * correo sale igual, sin adjunto. `image` evita armarlo de nuevo, `attach: false` lo manda sin
 * recibo (pedido aún sin confirmar) y `resend` obliga a enviar aunque ya se haya mandado.
 * Devuelve `true` si el servidor aceptó el envío.
 */
export async function emailReceipt(order, { image, attach = true, resend = false } = {}) {
  let base64 = ''
  if (attach) {
    try {
      base64 = (image ?? (await createReceiptImage(order))).base64
    } catch (error) {
      console.warn('No se pudo armar el recibo para el correo', error)
    }
  }
  return notifyPaymentApproved(order.id, base64, resend)
}
