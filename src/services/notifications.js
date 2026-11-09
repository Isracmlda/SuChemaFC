import { callScript } from './drive.js'

/**
 * Avisos por correo. Los envía el Apps Script (Code.gs) leyendo el pedido desde Firestore, así
 * el navegador solo manda el ID. Son de "mejor esfuerzo": si fallan (cuota de Google, red) el
 * pedido o el pago ya quedaron guardados, por eso nunca lanzan error. Devuelven `true` si el
 * servidor aceptó la solicitud y `false` si no, para que la pantalla pueda avisar.
 */
async function send(action, payload, options) {
  try {
    await callScript(action, payload, options)
    return true
  } catch (error) {
    console.warn(`No se pudo enviar el correo (${action})`, error)
    return false
  }
}

/** Cliente: avisa al cliente y a crsuchema@gmail.com que se hizo un pedido. */
export const notifyOrderCreated = (orderId) =>
  send('notifyOrderCreated', { orderId }, { requireSession: true })

/** Admin: avisa al cliente que el pago de su pedido fue aprobado. */
export const notifyPaymentApproved = (orderId) => send('notifyPaymentApproved', { orderId })

/** Admin: avisa a cada cliente con camisas en ese pedido al proveedor. */
export const notifySupplierUpdate = (supplierOrderId, note = '') =>
  send('notifySupplierUpdate', { supplierOrderId, note })
