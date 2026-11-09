/** Estados de un pedido (los mismos que valida `orderStatus()` en firestore.rules). */
export const ORDER_STATUS = {
  pago_pendiente_revision: 'Pago pendiente de revisión',
  adelanto_confirmado: 'Adelanto confirmado',
  pedido_al_proveedor: 'Pedido al proveedor',
  en_camino: 'En camino',
  listo_para_entrega: 'Listo para entrega',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  pago_rechazado: 'Pago rechazado',
}

export const statusLabel = (status) => ORDER_STATUS[status] ?? status

/** Estados en los que el pedido ya no necesita acción del cliente ni del admin. */
export const FINAL_STATUSES = ['entregado', 'cancelado']
