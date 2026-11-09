import { useContext } from 'react'
import { DialogContext } from '../context/dialogContext.js'

/**
 * Reemplazo de window.confirm / window.prompt con modals de la app.
 * - `confirm({ title, message, confirmLabel, danger })` → Promise<boolean>
 * - `showText({ title, message, text })` → Promise<void> (texto seleccionado para copiarlo a mano)
 */
export const useDialog = () => useContext(DialogContext)
