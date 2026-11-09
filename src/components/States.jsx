import { useEffect } from 'react'
import { useToast } from '../hooks/useToast.js'
import { errorMessage } from '../utils/errors.js'

export function Loading({ label = 'Cargando…' }) {
  return (
    <p role="status" className="py-10 text-center text-muted">
      {label}
    </p>
  )
}

export function EmptyState({ children }) {
  return (
    <p className="rounded-lg border border-dashed border-border py-10 text-center text-muted">
      {children}
    </p>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-danger">
        <span aria-hidden="true">⚠ </span>
        {errorMessage(error)}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-bold"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

/**
 * Aviso de resultado de una acción (éxito o error). No dibuja nada en su lugar: lo muestra como
 * toast (esquina superior derecha, bajo el navbar). Se avisa una vez por cada texto nuevo; para
 * repetir el mismo texto, limpia el aviso (`setNotice(null)`) antes de volver a ponerlo.
 */
export function Notice({ notice }) {
  const toast = useToast()
  const type = notice?.type
  const text = notice?.text
  useEffect(() => {
    if (text) toast.show({ type: type === 'error' ? 'error' : 'ok', text })
  }, [type, text, toast])
  return null
}

/** Aviso fijo en la página, para estados que deben seguir visibles (un bloqueo, un error de carga). */
export function InlineNotice({ notice }) {
  if (!notice) return null
  return (
    <p
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={`rounded-md border p-3 text-sm ${
        notice.type === 'error' ? 'border-danger text-danger' : 'border-success text-success'
      }`}
    >
      <span aria-hidden="true">{notice.type === 'error' ? '⚠ ' : '✓ '}</span>
      {notice.text}
    </p>
  )
}
