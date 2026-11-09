import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../utils/ui.js'
import { DialogContext } from './dialogContext.js'

const NARROW = 'w-[min(94vw,26rem)]'

function SelectedText({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      readOnly
      value={text}
      onFocus={(e) => e.target.select()}
      className={`${inputClass} font-mono`}
    />
  )
}

/**
 * Diálogos de la app (reemplazan window.confirm y window.prompt). Cada llamada devuelve una
 * promesa: `confirm` → true/false (cerrar o Esc cuenta como cancelar); `showText` → al cerrar.
 */
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const settle = useCallback((value) => {
    const resolve = resolver.current
    resolver.current = null
    setDialog(null)
    resolve?.(value)
  }, [])

  const open = useCallback(
    (spec) =>
      new Promise((resolve) => {
        resolver.current?.(false) // un diálogo nuevo cancela el anterior
        resolver.current = resolve
        setDialog(spec)
      }),
    [],
  )

  const api = useMemo(
    () => ({
      confirm: (options) => open({ kind: 'confirm', ...options }),
      showText: (options) => open({ kind: 'text', ...options }),
    }),
    [open],
  )

  const isConfirm = dialog?.kind === 'confirm'

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        open={Boolean(dialog)}
        onClose={() => settle(false)}
        title={dialog?.title ?? ''}
        width={NARROW}
      >
        {dialog && (
          <>
            {dialog.message && <p className="whitespace-pre-line text-sm">{dialog.message}</p>}
            {isConfirm ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => settle(false)} className={btnSecondary}>
                  {dialog.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className={dialog.danger ? btnDanger : btnPrimary}
                >
                  {dialog.confirmLabel ?? 'Aceptar'}
                </button>
              </div>
            ) : (
              <>
                <SelectedText text={dialog.text} />
                <div className="flex justify-end">
                  <button type="button" onClick={() => settle(true)} className={btnPrimary}>
                    Listo
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </DialogContext.Provider>
  )
}
