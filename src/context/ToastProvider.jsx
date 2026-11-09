import { useCallback, useMemo, useRef, useState } from 'react'
import Toasts from '../components/Toasts.jsx'
import { dropToast, pushToast } from '../utils/toasts.js'
import { ToastContext } from './toastContext.js'

/** Estado de los toasts. Debe ir dentro del router (un toast puede llevar un enlace). */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const show = useCallback((toast) => {
    nextId.current += 1
    const id = nextId.current
    setToasts((list) => pushToast(list, { type: 'ok', ...toast }, id))
  }, [])
  const dismiss = useCallback((id) => setToasts((list) => dropToast(list, id)), [])

  const api = useMemo(
    () => ({
      show,
      ok: (text, extra) => show({ ...extra, type: 'ok', text }),
      error: (text, extra) => show({ ...extra, type: 'error', text }),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
