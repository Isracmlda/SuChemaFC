import { useState } from 'react'
import { MdClose, MdLocalOffer } from 'react-icons/md'
import { useToast } from '../../hooks/useToast.js'
import { formatCRC } from '../../utils/format.js'
import { btnIcon, btnSecondary, inputClass } from '../../utils/ui.js'

/**
 * Campo para aplicar un cupón y mostrar su resultado.
 * - `code`: cupón aplicado (o ''); `result`: salida de evaluateCoupon; `loading`/`error`: carga del cupón.
 * - `onApply(texto)`: async, devuelve '' si se aplicó o el mensaje de error.
 */
export default function CouponBox({ code, result, loading, error, onApply, onRemove }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const problem = await onApply(text)
    if (problem) toast.error(problem)
    else setText('')
    setBusy(false)
  }

  if (code) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 rounded-md border border-border-strong px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MdLocalOffer className="size-5 text-accent" aria-hidden="true" />
            Cupón {code}
          </p>
          <button
            type="button"
            aria-label={`Quitar el cupón ${code}`}
            title="Quitar cupón"
            onClick={onRemove}
            className={btnIcon}
          >
            <MdClose className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p
          role={result && !result.ok && !loading ? 'alert' : 'status'}
          className={`text-sm ${result?.ok ? 'text-success' : 'text-danger'}`}
        >
          {loading && <span className="text-muted">Revisando cupón…</span>}
          {!loading && error && 'No se pudo revisar el cupón. Intenta de nuevo.'}
          {!loading && !error && result?.ok && `Descuento aplicado: −${formatCRC(result.discount)}`}
          {!loading && !error && result && !result.ok && result.reason}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">¿Tienes un cupón?</span>
        <span className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={60}
            placeholder="Escribe tu código"
            className={`${inputClass} uppercase`}
          />
          <button type="submit" disabled={busy || !text.trim()} className={btnSecondary}>
            {busy ? 'Revisando…' : 'Aplicar'}
          </button>
        </span>
      </label>
    </form>
  )
}
