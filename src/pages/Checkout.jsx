import { useState } from 'react'
import { MdImage, MdWarning } from 'react-icons/md'
import { Link } from 'react-router-dom'
import Field from '../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../components/States.jsx'
import { priceCart } from '../features/cart/cart.js'
import {
  MAX_ORDER_LINES,
  PROVINCES,
  SHIPPING_METHODS,
  buildOrderLines,
  emptyCustomer,
  minAdvance,
  orderTotal,
  shippingFee,
  validateCustomer,
} from '../features/checkout/checkout.js'
import OrderConfirmation from '../features/checkout/OrderConfirmation.jsx'
import { describeFee, enabledMethods } from '../features/checkout/settings.js'
import { couponOutcome } from '../features/pricing/coupon.js'
import { useAsync } from '../hooks/useAsync.js'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import { useCoupon } from '../hooks/useCoupon.js'
import { uploadReceipt } from '../services/drive.js'
import { notifyOrderCreated } from '../services/notifications.js'
import { loadCheckoutSettings, placeOrder } from '../services/orders.js'
import { loadCatalog } from '../services/storefront.js'
import { errorMessage } from '../utils/errors.js'
import { formatCRC } from '../utils/format.js'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../utils/ui.js'

const load = async () => {
  const [catalog, settings] = await Promise.all([loadCatalog(), loadCheckoutSettings()])
  return { catalog, settings }
}

const MAX_RECEIPT_BYTES = 12 * 1024 * 1024

function Row({ label, value, strong }) {
  return (
    <p
      className={`flex items-baseline justify-between gap-3 ${strong ? 'text-lg font-extrabold' : ''}`}
    >
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span>{value}</span>
    </p>
  )
}

function FieldError({ id, text }) {
  if (!text) return null
  return (
    <span id={id} role="alert" className="text-danger">
      <span aria-hidden="true">⚠ </span>
      {text}
    </span>
  )
}

export default function Checkout() {
  const { user } = useAuth()
  const { lines, couponCode, clearCart } = useCart()
  const { data, loading, error, reload } = useAsync(load)
  const applied = useCoupon(couponCode)

  const [form, setForm] = useState(() => emptyCustomer(user))
  const [method, setMethod] = useState('')
  const [advance, setAdvance] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptId, setReceiptId] = useState('') // comprobante ya subido: un reintento no lo repite
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [done, setDone] = useState(null)

  if (done) return <OrderConfirmation result={done.result} whatsappNumber={done.whatsappNumber} />

  if (lines.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4">
        <h1 className="self-start text-2xl font-bold">Finalizar compra</h1>
        <EmptyState>Tu carrito está vacío.</EmptyState>
        <Link to="/" className={btnPrimary}>
          Ver catálogo
        </Link>
      </section>
    )
  }
  if (loading) return <Loading label="Preparando tu compra…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { catalog, settings } = data
  const methods = enabledMethods(settings.shipping)
  const chosen = method || (methods.length === 1 ? methods[0] : '')

  if (!settings.ready) {
    return (
      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="self-start text-2xl font-bold">Finalizar compra</h1>
        <EmptyState>
          La tienda aún no está lista para recibir pedidos. Intenta de nuevo más tarde.
        </EmptyState>
        <Link to="/carrito" className={btnSecondary}>
          Volver al carrito
        </Link>
      </section>
    )
  }

  const cart = priceCart(lines, catalog)
  const coupon = couponOutcome(couponCode, applied, cart.items, catalog.sections)
  const couponPending = Boolean(couponCode) && !coupon
  const discount = coupon?.ok ? coupon.discount : 0
  const shipping = chosen ? shippingFee(chosen, settings.shipping) : 0
  const total = orderTotal({ subtotal: cart.subtotal, discount, shipping })
  const minimum = minAdvance(total, settings.advancePercent)
  const advanceValue = advance === '' ? minimum : Math.round(Number(advance))

  const errors = validateCustomer(form, chosen || 'whatsapp')
  const advanceError = !Number.isFinite(advanceValue)
    ? 'Escribe el monto que vas a enviar.'
    : advanceValue < minimum
      ? `El adelanto mínimo es ${formatCRC(minimum)}.`
      : advanceValue > total
        ? 'El adelanto no puede ser mayor al total.'
        : ''
  const receiptError = !receipt && !receiptId ? 'Adjunta la foto o captura de tu comprobante.' : ''
  const blockers = [
    !chosen && 'Elige cómo quieres recibir tu pedido.',
    cart.hasChanges && 'Algunos precios cambiaron. Vuelve al carrito y acéptalos.',
    cart.hasUnavailable && 'Hay camisas no disponibles. Quítalas del carrito.',
    couponCode && coupon && !coupon.ok && coupon.reason,
    couponPending && 'Estamos revisando tu cupón…',
    cart.items.filter((i) => i.status === 'ok').length === 0 && 'No hay camisas para comprar.',
    cart.items.length > MAX_ORDER_LINES &&
      `Un pedido admite hasta ${MAX_ORDER_LINES} líneas. Divide tu compra en dos pedidos.`,
  ].filter(Boolean)
  const canSubmit =
    blockers.length === 0 && Object.keys(errors).length === 0 && !advanceError && !receiptError

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const show = (key) => (tried ? errors[key] : '')

  function pickReceipt(file) {
    setNotice(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', text: 'El comprobante debe ser una imagen (JPG, PNG o WebP).' })
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setNotice({ type: 'error', text: 'La imagen es demasiado pesada (máximo 12 MB).' })
      return
    }
    setReceipt(file)
    setReceiptId('') // otro archivo: se sube de nuevo
  }

  async function submit(event) {
    event.preventDefault()
    setTried(true)
    if (!canSubmit || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const fileId = receiptId || (await uploadReceipt(receipt))
      setReceiptId(fileId)
      const orderLines = buildOrderLines(cart.items)
      const result = await placeOrder({
        receiptFileId: fileId,
        items: orderLines,
        form,
        method: chosen,
        subtotal: cart.subtotal,
        discount,
        couponCode: discount > 0 ? couponCode : '',
        shipping,
        advanceRequired: advanceValue,
      })
      // Correo al cliente y a la tienda. No se espera: el pedido ya está guardado.
      notifyOrderCreated(result.orderId)
      clearCart()
      setDone({
        whatsappNumber: settings.whatsappNumber,
        result: {
          ...result,
          customerName: form.name.trim(),
          lines: orderLines,
          method: chosen,
          totals: { total, advanceRequired: advanceValue },
        },
      })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Finalizar compra</h1>

      <section className={`${cardClass} flex flex-col gap-3`} aria-labelledby="co-delivery">
        <h2 id="co-delivery" className="text-lg font-bold">
          1. ¿Cómo quieres recibirlo?
        </h2>
        <div role="radiogroup" aria-label="Forma de entrega" className="grid gap-2">
          {methods.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm ${
                chosen === m ? 'border-accent bg-surface-2' : 'border-border-strong'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="method"
                  checked={chosen === m}
                  onChange={() => setMethod(m)}
                  className="size-4 accent-[var(--accent-solid)]"
                />
                {SHIPPING_METHODS[m]}
                {m === 'correos' && (
                  <span className="font-normal text-muted">
                    ({describeFee(settings.shipping.correosFee)})
                  </span>
                )}
              </span>
              <span className="text-muted">
                {m === 'correos' ? settings.shipping.correosText : settings.shipping.whatsappText}
              </span>
            </label>
          ))}
        </div>
        {tried && !chosen && (
          <p role="alert" className="text-sm text-danger">
            <span aria-hidden="true">⚠ </span>Elige cómo quieres recibir tu pedido.
          </p>
        )}
      </section>

      <section className={`${cardClass} grid gap-3 sm:grid-cols-2`} aria-labelledby="co-data">
        <h2 id="co-data" className="text-lg font-bold sm:col-span-2">
          2. Tus datos
        </h2>
        <Field label="Nombre completo" className="sm:col-span-2">
          <input
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            maxLength={100}
            className={inputClass}
            aria-invalid={Boolean(show('name'))}
          />
          <FieldError text={show('name')} />
        </Field>
        <Field label="Teléfono / WhatsApp">
          <input
            value={form.phone}
            onChange={set('phone')}
            type="tel"
            autoComplete="tel"
            maxLength={30}
            className={inputClass}
            aria-invalid={Boolean(show('phone'))}
          />
          <FieldError text={show('phone')} />
        </Field>
        <Field
          label="Correo"
          hint="Te avisamos aquí cuando aprobemos tu pago y cuando haya novedades."
        >
          <input
            value={form.email}
            onChange={set('email')}
            type="email"
            autoComplete="email"
            maxLength={200}
            className={inputClass}
            aria-invalid={Boolean(show('email'))}
          />
          <FieldError text={show('email')} />
        </Field>
        {chosen === 'correos' && (
          <>
            <Field label="Provincia">
              <select
                value={form.province}
                onChange={set('province')}
                className={inputClass}
                aria-invalid={Boolean(show('province'))}
              >
                <option value="">Elige…</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError text={show('province')} />
            </Field>
            <Field label="Cantón">
              <input
                value={form.canton}
                onChange={set('canton')}
                maxLength={100}
                className={inputClass}
                aria-invalid={Boolean(show('canton'))}
              />
              <FieldError text={show('canton')} />
            </Field>
            <Field label="Distrito">
              <input
                value={form.district}
                onChange={set('district')}
                maxLength={100}
                className={inputClass}
                aria-invalid={Boolean(show('district'))}
              />
              <FieldError text={show('district')} />
            </Field>
            <Field
              label="Otras señas"
              className="sm:col-span-2"
              hint="Calle, casa, referencias para el cartero."
            >
              <textarea
                value={form.details}
                onChange={set('details')}
                rows={3}
                maxLength={300}
                className={`${inputClass} py-2`}
                aria-invalid={Boolean(show('details'))}
              />
              <FieldError text={show('details')} />
            </Field>
          </>
        )}
        <Field label="Nota para el pedido (opcional)" className="sm:col-span-2">
          <textarea
            value={form.note}
            onChange={set('note')}
            rows={2}
            maxLength={500}
            className={`${inputClass} py-2`}
          />
        </Field>
      </section>

      <section className={`${cardClass} flex flex-col gap-2`} aria-labelledby="co-summary">
        <h2 id="co-summary" className="text-lg font-bold">
          3. Resumen
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {cart.items
            .filter((i) => i.status === 'ok')
            .map((i) => (
              <li key={i.line.key} className="flex justify-between gap-3">
                <span>
                  {i.line.qty} × {i.product.name}
                  {i.variantName ? ` · ${i.variantName}` : ''} (talla {i.line.size})
                </span>
                <span>{formatCRC(i.total)}</span>
              </li>
            ))}
        </ul>
        <hr className="border-border" />
        <Row label="Subtotal" value={formatCRC(cart.subtotal)} />
        {discount > 0 && <Row label={`Cupón ${couponCode}`} value={`−${formatCRC(discount)}`} />}
        {chosen && (
          <Row label="Envío" value={shipping > 0 ? formatCRC(shipping) : 'Sin costo extra'} />
        )}
        <Row label="Total" value={formatCRC(total)} strong />
        <p className="text-sm text-muted">
          <Link to="/carrito" className="font-semibold text-accent underline">
            Editar carrito o cupón
          </Link>
        </p>
      </section>

      <section className={`${cardClass} flex flex-col gap-3`} aria-labelledby="co-pay">
        <h2 id="co-pay" className="text-lg font-bold">
          4. Adelanto por SINPE
        </h2>
        <p className="text-sm">
          Para reservar tu pedido envía al menos el <strong>{settings.advancePercent}%</strong>:{' '}
          <strong>{formatCRC(minimum)}</strong>. El saldo se paga antes de la entrega.
        </p>
        {settings.methods.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-danger">
            <MdWarning className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            Aún no hay datos de pago configurados. Escríbenos por WhatsApp antes de pagar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settings.methods.map((m) => (
              <li key={m.id} className="rounded-md bg-surface-2 p-3 text-sm">
                <p className="font-semibold">{m.type === 'sinpe' ? 'SINPE Móvil' : m.type}</p>
                <p className="text-lg font-extrabold">{m.number}</p>
                <p>A nombre de {m.holder}</p>
                {m.notes && <p className="text-muted">{m.notes}</p>}
              </li>
            ))}
          </ul>
        )}

        <Field
          label="Monto que enviaste (₡)"
          hint={`Mínimo ${formatCRC(minimum)}. Puedes enviar más, hasta el total.`}
        >
          <input
            type="number"
            min={minimum}
            max={total}
            step="1"
            inputMode="numeric"
            value={advance === '' ? minimum : advance}
            onChange={(e) => setAdvance(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(tried && advanceError)}
          />
          {tried && <FieldError text={advanceError} />}
        </Field>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="receipt" className="font-semibold">
            Comprobante de SINPE
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            onChange={(e) => pickReceipt(e.target.files?.[0])}
            className="text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-4 file:font-semibold file:text-fg"
          />
          {receipt && (
            <span className="flex items-center gap-2 text-muted">
              <MdImage className="size-5" aria-hidden="true" />
              {receipt.name}
            </span>
          )}
          {tried && <FieldError text={receiptError} />}
          <span className="text-muted">
            Se guarda en una carpeta privada y solo la revisa el equipo de la tienda.
          </span>
        </div>
      </section>

      {tried && blockers.length > 0 && (
        <ul role="alert" className="list-inside list-disc text-sm text-danger">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? 'Enviando tu pedido…' : 'Confirmar pedido'}
        </button>
        <Link to="/carrito" className={btnSecondary}>
          Volver al carrito
        </Link>
      </div>
    </form>
  )
}
