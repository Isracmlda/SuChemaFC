import { useState } from 'react'
import { MdAdd, MdDelete, MdEdit, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import {
  deletePaymentMethod,
  loadCheckoutSettings,
  savePaymentMethod,
  saveStoreSettings,
} from '../../../services/orders.js'
import { errorMessage } from '../../../utils/errors.js'
import { toInt } from '../../../utils/format.js'
import { nextOrder } from '../../../utils/tree.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { PAYMENT_TYPES, validateMethod, validateSettingsForm } from '../../checkout/settings.js'

const load = () => loadCheckoutSettings()
const EMPTY_METHOD = { type: 'sinpe', number: '', holder: '', notes: '', visible: true }

function Check({ checked, onChange, children }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--accent-solid)]"
      />
      {children}
    </label>
  )
}

function StoreSettings({ settings, onSaved }) {
  const [percent, setPercent] = useState(settings.advancePercent)
  const [shipping, setShipping] = useState(settings.shipping)
  const [whatsapp, setWhatsapp] = useState(settings.whatsappNumber)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const problem = validateSettingsForm({
    advancePercent: percent,
    shipping,
    whatsappNumber: whatsapp,
  })
  const set = (patch) => setShipping((s) => ({ ...s, ...patch }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await saveStoreSettings({ advancePercent: percent, shipping, whatsappNumber: whatsapp })
      setNotice({ type: 'ok', text: 'Ajustes guardados.' })
      onSaved()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-bold">Pago, envío y WhatsApp</h2>
      {!settings.ready && (
        <p role="alert" className="text-sm text-danger">
          <span aria-hidden="true">⚠ </span>
          Sin el porcentaje de adelanto guardado, los clientes no pueden crear pedidos.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Adelanto mínimo (%)" hint="Entero de 1 a 100.">
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            inputMode="numeric"
            value={percent}
            onChange={(e) => setPercent(toInt(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field
          label="WhatsApp de la tienda"
          hint="Con código de país, ej. 50688888888. 8 dígitos = Costa Rica."
        >
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Correos de Costa Rica</legend>
        <Check checked={shipping.correosEnabled} onChange={(v) => set({ correosEnabled: v })}>
          Ofrecer envío por Correos
        </Check>
        <Field label="Tarifa extra (₡)" hint="0 = sin costo extra.">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={shipping.correosFee}
            onChange={(e) => set({ correosFee: toInt(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Texto que ve el cliente">
          <textarea
            rows={3}
            maxLength={500}
            value={shipping.correosText}
            onChange={(e) => set({ correosText: e.target.value })}
            className={`${inputClass} py-2`}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Entrega coordinada por WhatsApp</legend>
        <Check checked={shipping.whatsappEnabled} onChange={(v) => set({ whatsappEnabled: v })}>
          Ofrecer entrega coordinada
        </Check>
        <Field label="Texto que ve el cliente">
          <textarea
            rows={3}
            maxLength={500}
            value={shipping.whatsappText}
            onChange={(e) => set({ whatsappText: e.target.value })}
            className={`${inputClass} py-2`}
          />
        </Field>
      </fieldset>

      {problem && <p className="text-sm text-muted">{problem}</p>}
      <Notice notice={notice} />
      <button
        type="submit"
        disabled={busy || Boolean(problem)}
        className={`${btnPrimary} self-start`}
      >
        {busy ? 'Guardando…' : 'Guardar ajustes'}
      </button>
    </form>
  )
}

function MethodForm({ initial, onCancel, onSave, busy }) {
  const [m, setM] = useState(initial)
  const problem = validateMethod(m)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(m)
      }}
      className={`${cardClass} flex flex-col gap-3`}
    >
      <h3 className="font-bold">{m.id ? 'Editar método de pago' : 'Nuevo método de pago'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <select
            value={m.type}
            onChange={(e) => setM({ ...m, type: e.target.value })}
            className={inputClass}
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número o cuenta">
          <input
            value={m.number}
            onChange={(e) => setM({ ...m, number: e.target.value })}
            maxLength={60}
            className={inputClass}
          />
        </Field>
        <Field label="Titular">
          <input
            value={m.holder}
            onChange={(e) => setM({ ...m, holder: e.target.value })}
            maxLength={100}
            className={inputClass}
          />
        </Field>
        <Field label="Indicaciones (opcional)">
          <input
            value={m.notes}
            onChange={(e) => setM({ ...m, notes: e.target.value })}
            maxLength={200}
            className={inputClass}
          />
        </Field>
      </div>
      <Check checked={m.visible} onChange={(v) => setM({ ...m, visible: v })}>
        Visible para los clientes
      </Check>
      {problem && <p className="text-sm text-muted">{problem}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || Boolean(problem)} className={btnPrimary}>
          Guardar
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function StoreSettingsPage() {
  const { data, loading, error, reload } = useAsync(load)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  async function act(action, okText, after) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      setNotice({ type: 'ok', text: okText })
      after?.()
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StoreSettings
        key={JSON.stringify(data.shipping) + data.advancePercent + data.whatsappNumber}
        settings={data}
        onSaved={reload}
      />

      <section className="flex flex-col gap-3" aria-labelledby="methods-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="methods-title" className="text-lg font-bold">
            Métodos de pago
          </h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(EMPTY_METHOD)} className={btnSecondary}>
              <MdAdd className="size-5" aria-hidden="true" />
              Agregar método
            </button>
          )}
        </div>
        <Notice notice={notice} />
        {editing && (
          <MethodForm
            key={editing.id ?? 'new'}
            initial={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(m) =>
              act(
                () => savePaymentMethod(m, nextOrder(data.methods)),
                'Método guardado.',
                () => setEditing(null),
              )
            }
          />
        )}
        {data.methods.length === 0 && !editing ? (
          <EmptyState>
            Aún no hay métodos de pago. Los clientes no verán a dónde enviar el adelanto.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.methods.map((m) => (
              <li key={m.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.type === 'sinpe' ? 'SINPE Móvil' : m.type} · {m.number}
                  </p>
                  <p className="text-sm text-muted">A nombre de {m.holder}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Editar el método de ${m.holder}`}
                  title="Editar"
                  onClick={() => setEditing(m)}
                  className={btnIcon}
                >
                  <MdEdit className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={
                    m.visible
                      ? `Ocultar el método de ${m.holder}`
                      : `Mostrar el método de ${m.holder}`
                  }
                  title={m.visible ? 'Ocultar' : 'Mostrar'}
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => savePaymentMethod({ ...m, visible: !m.visible }),
                      m.visible ? 'Oculto.' : 'Visible.',
                    )
                  }
                  className={btnIcon}
                >
                  {m.visible ? (
                    <MdVisibility className="size-5" aria-hidden="true" />
                  ) : (
                    <MdVisibilityOff className="size-5" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar el método de ${m.holder}`}
                  title="Eliminar"
                  disabled={busy}
                  onClick={() =>
                    window.confirm('¿Eliminar este método de pago?') &&
                    act(() => deletePaymentMethod(m), 'Método eliminado.')
                  }
                  className={btnIcon}
                >
                  <MdDelete className="size-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
