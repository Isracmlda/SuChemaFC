import { createContext } from 'react'

/** Valor por defecto sin proveedor (pruebas): no hace nada. */
export const ToastContext = createContext({
  show: () => {},
  ok: () => {},
  error: () => {},
  dismiss: () => {},
})
