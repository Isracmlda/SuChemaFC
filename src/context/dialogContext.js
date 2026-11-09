import { createContext } from 'react'

/** Valor por defecto sin proveedor (pruebas): confirma siempre y no muestra nada. */
export const DialogContext = createContext({
  confirm: async () => true,
  showText: async () => {},
})
