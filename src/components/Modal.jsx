import { useEffect, useId, useRef } from 'react'
import { MdClose } from 'react-icons/md'

/**
 * Ventana modal con <dialog> (maneja el foco y la tecla Esc). El contenido solo existe mientras
 * está abierta, así sus formularios empiezan limpios cada vez. Debe ir FUERA de cualquier <form>.
 */
export default function Modal({ open, onClose, title, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(94vw,44rem)] rounded-lg border border-border-strong bg-bg p-0 text-fg backdrop:bg-black/70"
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col gap-4 overflow-y-auto p-5">
          <header className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-md border border-border-strong hover:border-accent"
            >
              <MdClose className="size-5" aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
