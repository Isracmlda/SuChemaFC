import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdAccountCircle, MdLogin, MdLogout, MdReceiptLong } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth.js'
import { authErrorMessage, signInWithGoogle, signOutUser } from '../services/auth.js'
import { navIconClass } from '../utils/ui.js'
import { Notice } from './States.jsx'
import Tooltip from './Tooltip.jsx'

const iconButtonClass = navIconClass

// Filas con texto para el menú desplegable del móvil.
export const menuRowClass =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-sm font-semibold text-brand-white hover:bg-brand-gold hover:text-brand-black disabled:cursor-wait disabled:opacity-60'

/**
 * Acceso/salida de sesión para el navbar (que siempre es negro, por eso usa colores de marca).
 * Con `stacked` se dibuja como lista de filas con texto, para el menú desplegable del móvil.
 */
export default function UserMenu({ stacked = false }) {
  const { user, isGuest, configured } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!configured) return null

  // Abre Google directamente. La página /login queda oculta para futuros métodos de acceso.
  async function handleSignIn() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      // Cerrar la ventana a propósito no es un error que mostrar.
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(authErrorMessage(e))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!user || isGuest) {
    if (stacked) {
      return (
        <>
          <button type="button" onClick={handleSignIn} disabled={busy} className={menuRowClass}>
            <MdLogin className="size-6 shrink-0" aria-hidden="true" />
            Ingresar con Google
          </button>
          <Notice notice={error ? { type: 'error', text: error } : null} />
        </>
      )
    }
    return (
      <div className="relative">
        <Tooltip label="Ingresar con Google">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={busy}
            aria-label="Ingresar con Google"
            className={`${iconButtonClass} disabled:cursor-wait disabled:opacity-60`}
          >
            <MdLogin className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>
        <Notice notice={error ? { type: 'error', text: error } : null} />
      </div>
    )
  }

  if (stacked) {
    return (
      <>
        <div className="flex items-center gap-3 px-3 py-2" title={user.displayName || user.email}>
          <Avatar user={user} />
          <span className="min-w-0 truncate text-sm font-semibold text-brand-white">
            {firstName(user)}
          </span>
        </div>
        <Link to="/mis-pedidos" className={menuRowClass}>
          <MdReceiptLong className="size-6 shrink-0" aria-hidden="true" />
          Mis pedidos
        </Link>
        <button type="button" onClick={signOutUser} className={menuRowClass}>
          <MdLogout className="size-6 shrink-0" aria-hidden="true" />
          Cerrar sesión
        </button>
      </>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip label="Mis pedidos">
        <Link to="/mis-pedidos" aria-label="Mis pedidos" className={iconButtonClass}>
          <MdReceiptLong className="size-5" aria-hidden="true" />
        </Link>
      </Tooltip>
    </div>
  )
}

/** Solo el primer nombre (sin apellidos); si no hay nombre, la parte local del correo. */
function firstName(user) {
  return user.displayName?.trim().split(/\s+/)[0] || user.email?.split('@')[0] || 'Mi cuenta'
}

function Avatar({ user }) {
  return user.photoURL ? (
    <img
      src={user.photoURL}
      alt=""
      referrerPolicy="no-referrer"
      className="size-8 shrink-0 rounded-full border border-brand-gold object-cover"
    />
  ) : (
    <MdAccountCircle className="size-8 shrink-0 text-brand-gold" aria-hidden="true" />
  )
}

/**
 * Cuenta de escritorio para el final del navbar: foto, primer nombre y debajo "Cerrar sesión".
 * Sin sesión (o invitado) no muestra nada: ahí solo queda el ícono de ingresar de UserMenu.
 */
export function AccountBadge() {
  const { user, isGuest, configured } = useAuth()
  if (!configured || !user || isGuest) return null

  return (
    <div
      className="ms-2 flex items-center gap-2 border-s border-brand-gold/40 ps-3"
      title={user.displayName || user.email}
    >
      <Avatar user={user} />
      <div className="flex min-w-0 flex-col items-start leading-tight">
        <span className="max-w-28 truncate text-sm font-semibold text-brand-white">
          {firstName(user)}
        </span>
        <button
          type="button"
          onClick={signOutUser}
          className="rounded text-xs font-semibold text-brand-gold underline-offset-2 hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
