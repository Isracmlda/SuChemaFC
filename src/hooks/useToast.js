import { useContext } from 'react'
import { ToastContext } from '../context/toastContext.js'

/** { show({type, text, action}), ok(text, opts), error(text, opts), dismiss(id) } */
export const useToast = () => useContext(ToastContext)
