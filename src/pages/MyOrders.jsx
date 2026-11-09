import { useCallback, useState } from 'react'
import { MdLogin } from 'react-icons/md'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../components/States.jsx'
import { SHIPPING_METHODS, orderRef } from '../features/checkout/checkout.js'
import { describeCustom } from '../features/personalization/personalization.js'
import { orderBalance, sortOrdersByDate } from '../features/tracking/tracking.js'
import { useAsync } from '../hooks/useAsync.js'
import { useAuth } from '../hooks/useAuth.js'
import { authErrorMessage, signInWithGoogle } from '../services/auth.js'
import { listMyOrders } from '../services/tracking.js'
import { formatDateTime, toMillis } from '../utils/dates.js'
import { formatCRC } from '../utils/format.js'
import { btnPrimary, btnSecondary, cardClass } from '../utils/ui.js'

const PAGE = 10

function SignInPrompt() {
  const [error, setError] = useState('')
  async function signIn() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(authErrorMessage(e))
      }
    }
  }
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <h1 className="self-start text-2xl font-bold">Mis pedidos</h1>
      <p className="text-muted">
        Ingresa con Google para ver tu historial. Si ya compraste como invitado en este dispositivo,
        tus pedidos se conservan al ingresar.
      </p>
      <button type="button" onClick={signIn} className={btnPrimary}>
        <MdLogin className="size-5" aria-hidden="true" />
        Ingresar con Google
      </button>
      {error && <Notice notice={{ type: 'error', text: error }} />}
      <p className="text-sm text-muted">
        ¿Sin cuenta? Consulta un pedido con su código en{' '}
        <Link to="/rastreo" className="font-semibold text-accent underline">
          Rastreo
        </Link>
        .
      </p>
    </section>
  )
}

function OrderCard({ order }) {
  return (
    <li className={`${cardClass} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">Pedido {orderRef(order.id)}</p>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-sm text-muted">{formatDateTime(toMillis(order.createdAt))}</p>
      <ul className="list-disc ps-5 text-sm">
        {order.lines.map((l, i) => (
          <li key={i}>
            {l.qty} × {l.name} (talla {l.size})
            {l.patches?.length > 0 && ` · ${l.patches.map((p) => p.name).join(', ')}`}
            {l.custom && ` · ${describeCustom(l.custom)}`}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Total {formatCRC(order.total)} · Pagado {formatCRC(order.paidAmount ?? 0)} · Saldo{' '}
        <strong>{formatCRC(orderBalance(order))}</strong> · {SHIPPING_METHODS[order.shippingMethod]}
      </p>
      <Link
        to={`/rastreo?pedido=${encodeURIComponent(order.trackingCode)}`}
        className={`${btnSecondary} self-start`}
      >
        Ver seguimiento
      </Link>
    </li>
  )
}

function OrderList({ uid }) {
  const load = useCallback(() => listMyOrders(uid), [uid])
  const { data, loading, error, reload } = useAsync(load)
  const [visible, setVisible] = useState(PAGE)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const orders = sortOrdersByDate(data)

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>
      {orders.length === 0 ? (
        <EmptyState>Aún no tienes pedidos con esta cuenta.</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {orders.slice(0, visible).map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
          {orders.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className={`${btnSecondary} self-center`}
            >
              Ver más ({orders.length - visible})
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Historial de pedidos de la cuenta de Google. */
export default function MyOrders() {
  const { user, isGuest, loading, configured } = useAuth()
  if (!configured) return <EmptyState>Esta función requiere conexión con la tienda.</EmptyState>
  if (loading) return <Loading />
  if (!user || isGuest) return <SignInPrompt />
  return <OrderList uid={user.uid} />
}
