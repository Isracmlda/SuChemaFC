import { useEffect, useRef } from 'react'
import { MdCheckCircle, MdClose, MdErrorOutline } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { toastDuration } from '../utils/toasts.js'

function Toast({ toast, onDismiss }) {
  const error = toast.type === 'error'
  const Icon = error ? MdErrorOutline : MdCheckCircle

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toastDuration(toast.type))
    return () => clearTimeout(timer)
  }, [toast.id, toast.type, onDismiss])

  return (
    <div
      className={`toast-enter pointer-events-auto flex items-start gap-2 rounded-md border bg-surface p-3 text-sm text-fg shadow-lg ${
        error ? 'border-danger' : 'border-success'
      }`}
    >
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${error ? 'text-danger' : 'text-success'}`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 break-words">
        {toast.text}
        {toast.action && (
          <>
            {' '}
            <Link
              to={toast.action.to}
              onClick={() => onDismiss(toast.id)}
              className="font-bold underline"
            >
              {toast.action.label}
            </Link>
          </>
        )}
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:text-fg"
      >
        <MdClose className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Zona de toasts: esquina superior derecha, justo debajo del navbar (que mide ~4.1 rem).
 * Usa la capa superior del navegador (popover) para verse también sobre los modals; si hay un
 * modal abierto cuando llega un aviso nuevo, se vuelve a abrir encima de él.
 */
export default function Toasts({ toasts, onDismiss }) {
  const ref = useRef(null)
  const count = toasts.length
  const last = toasts.at(-1)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.showPopover !== 'function') return
    if (count === 0) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    if (el.matches(':popover-open') && document.querySelector('dialog[open]')) el.hidePopover()
    if (!el.matches(':popover-open')) el.showPopover()
  }, [count, last?.id])

  return (
    <>
      {/* Región viva siempre presente: los lectores de pantalla anuncian el último aviso. */}
      <div role="status" aria-live="polite" className="sr-only">
        {last?.text}
      </div>
      <div
        ref={ref}
        popover="manual"
        className="pointer-events-none fixed bottom-auto left-auto right-3 top-[4.75rem] m-0 w-[min(calc(100vw-1.5rem),24rem)] flex-col gap-2 overflow-visible border-0 bg-transparent p-0 [&:popover-open]:flex"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  )
}
