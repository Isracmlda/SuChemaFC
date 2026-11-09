import { MdDelete } from 'react-icons/md'
import { Link } from 'react-router-dom'
import DriveImage from '../components/DriveImage.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../components/States.jsx'
import { MAX_QTY, priceCart } from '../features/cart/cart.js'
import { couponOutcome, evaluateCoupon, normalizeCode } from '../features/pricing/coupon.js'
import CouponBox from '../features/pricing/CouponBox.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useCart } from '../hooks/useCart.js'
import { useCoupon } from '../hooks/useCoupon.js'
import { useDialog } from '../hooks/useDialog.js'
import { fetchCoupon } from '../services/promotions.js'
import { loadCatalog } from '../services/storefront.js'
import { formatCRC } from '../utils/format.js'
import { actionRowClass, btnIcon, btnPrimary, btnSecondary, cardClass } from '../utils/ui.js'
import { describeCustom } from '../features/personalization/personalization.js'

// El catálogo se guarda 5 minutos en memoria: abrir el carrito revalida los precios con esa vigencia.
const loadFresh = () => loadCatalog()

function QtyControl({ item, onChange }) {
  const { qty } = item.line
  const name = item.product.name
  return (
    <div className="inline-flex items-center rounded-md border border-border-strong">
      <button
        type="button"
        aria-label={`Menos unidades de ${name}`}
        disabled={qty <= 1}
        onClick={() => onChange(qty - 1)}
        className="size-10 text-lg font-bold disabled:opacity-40"
      >
        −
      </button>
      <output aria-label={`Cantidad de ${name}`} className="w-8 text-center font-semibold">
        {qty}
      </output>
      <button
        type="button"
        aria-label={`Más unidades de ${name}`}
        disabled={qty >= MAX_QTY}
        onClick={() => onChange(qty + 1)}
        className="size-10 text-lg font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

function Line({ item, onQty, onRemove }) {
  const { line, product } = item
  if (item.status === 'unavailable') {
    return (
      <li className={`${cardClass} flex items-center gap-3`}>
        <p className="flex-1 text-sm text-muted">
          Una camisa de tu carrito ya no está disponible. No se incluye en el total.
        </p>
        <button
          type="button"
          aria-label="Quitar camisa no disponible"
          title="Quitar"
          onClick={() => onRemove(line.key)}
          className={btnIcon}
        >
          <MdDelete className="size-5" aria-hidden="true" />
        </button>
      </li>
    )
  }

  return (
    <li className={`${cardClass} flex gap-3`}>
      <Link to={`/producto/${product.id}`} className="shrink-0" aria-label={`Ver ${product.name}`}>
        <DriveImage id={product.images?.[0]} size={200} className="size-20 rounded-md sm:size-24" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={`/producto/${product.id}`} className="font-semibold hover:text-accent">
          {product.name}
        </Link>
        <ul className="text-sm text-muted">
          {item.variantName && <li>Versión: {item.variantName}</li>}
          <li>Talla {line.size}</li>
          {item.patches.map((p) => (
            <li key={p.group}>
              {p.group}: {p.name} (+{formatCRC(p.price)})
            </li>
          ))}
          {line.custom && <li>Personalizada: {describeCustom(line.custom)}</li>}
        </ul>
        {item.changed && (
          <p className="text-sm font-semibold text-accent">
            Precio actualizado: antes {formatCRC(line.priceAt)}, ahora {formatCRC(item.unit)}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <QtyControl item={item} onChange={(q) => onQty(line.key, q)} />
          <p className="text-right">
            <span className="block text-xs text-muted">
              {line.qty} × {formatCRC(item.unit)}
            </span>
            <span className="font-bold">{formatCRC(item.total)}</span>
          </p>
          <button
            type="button"
            aria-label={`Quitar ${product.name} talla ${line.size}`}
            title="Quitar"
            onClick={() => onRemove(line.key)}
            className={btnIcon}
          >
            <MdDelete className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  )
}

export default function Cart() {
  const {
    lines,
    couponCode,
    setCouponCode,
    setQty,
    removeLine,
    clearCart,
    acknowledge,
    syncing,
    syncError,
  } = useCart()
  const dialog = useDialog()
  const applied = useCoupon(couponCode)
  const { data: catalog, loading, error, reload } = useAsync(loadFresh)

  if (lines.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4">
        <h1 className="self-start text-2xl font-bold">Carrito</h1>
        <EmptyState>Tu carrito está vacío.</EmptyState>
        <Link to="/" className={btnPrimary}>
          Ver catálogo
        </Link>
      </section>
    )
  }
  if (loading) return <Loading label="Revisando precios…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const cart = priceCart(lines, catalog)
  const couponResult = couponOutcome(couponCode, applied, cart.items, catalog.sections)
  const discount = couponResult?.ok ? couponResult.discount : 0

  async function applyCoupon(text) {
    const code = normalizeCode(text)
    try {
      const coupon = await fetchCoupon(code)
      if (!coupon) return 'Ese cupón no existe o no está activo.'
      const result = evaluateCoupon(coupon, cart.items, catalog.sections)
      if (!result.ok) return result.reason
      setCouponCode(code)
      return ''
    } catch {
      return 'No se pudo revisar el cupón. Intenta de nuevo.'
    }
  }
  async function askClear() {
    const sure = await dialog.confirm({
      title: 'Vaciar carrito',
      message: '¿Vaciar el carrito?',
      confirmLabel: 'Vaciar',
      danger: true,
    })
    if (sure) clearCart()
  }
  const acceptPrices = () =>
    acknowledge(
      Object.fromEntries(cart.items.filter((i) => i.changed).map((i) => [i.line.key, i.unit])),
    )
  const canCheckout = !syncing && !cart.hasChanges && cart.items.some((i) => i.status === 'ok')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Carrito</h1>
        <button
          type="button"
          onClick={askClear}
          className="text-sm font-semibold text-accent underline"
        >
          Vaciar
        </button>
      </div>

      {cart.hasChanges && (
        <div role="alert" className={`${cardClass} flex flex-col gap-3 border-accent`}>
          <p>
            Algunos precios cambiaron desde que agregaste las camisas. Revisa los totales y acepta
            para continuar.
          </p>
          <button type="button" onClick={acceptPrices} className={`${btnPrimary} self-start`}>
            Aceptar precios actuales
          </button>
        </div>
      )}
      <Notice
        notice={
          syncError
            ? {
                type: 'error',
                text: 'No se pudo sincronizar con tu cuenta. Tu carrito sigue guardado en este dispositivo.',
              }
            : null
        }
      />

      <ul className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <Line key={item.line.key} item={item} onQty={setQty} onRemove={removeLine} />
        ))}
      </ul>

      <div className={`${cardClass} flex flex-col gap-3`}>
        <p className="flex items-baseline justify-between text-lg">
          <span className="font-semibold">Subtotal</span>
          <span className="text-2xl font-extrabold" aria-live="polite">
            {formatCRC(cart.subtotal)}
          </span>
        </p>
        <CouponBox
          code={couponCode}
          result={couponResult}
          loading={applied.loading}
          error={applied.error}
          onApply={applyCoupon}
          onRemove={() => setCouponCode('')}
        />
        {discount > 0 && (
          <p className="flex items-baseline justify-between">
            <span className="font-semibold">Total con descuento</span>
            <span className="text-xl font-extrabold">{formatCRC(cart.subtotal - discount)}</span>
          </p>
        )}
        <p className="text-sm text-muted">El envío se calcula al finalizar la compra.</p>
        <div className={actionRowClass}>
          {canCheckout ? (
            <Link to="/checkout" className={btnPrimary}>
              Finalizar compra
            </Link>
          ) : (
            <button type="button" disabled className={btnPrimary}>
              Finalizar compra
            </button>
          )}
          <Link to="/" className={btnSecondary}>
            Seguir comprando
          </Link>
        </div>
      </div>
    </section>
  )
}
