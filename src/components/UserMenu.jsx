import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAccountCircle,
  MdAdminPanelSettings,
  MdLogin,
  MdLogout,
  MdReceiptLong,
} from 'react-icons/md'
import { useAuth } from '../hooks/useAuth.js'
import { authErrorMessage, signInWithGoogle, signOutUser } from '../services/auth.js'
import Tooltip from './Tooltip.jsx'

const iconButtonClass =
  'inline-flex size-11 items-center justify-center rounded-md border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-black'

// Filas con texto para el menú desplegable del móvil.
export const menuRowClass =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-sm font-semibold text-brand-white hover:bg-brand-gold hover:text-brand-black disabled:cursor-wait disabled:opacity-60'

/**
 * Acceso/salida de sesión para el navbar (que siempre es negro, por eso usa colores de marca).
 * Con `stacked` se dibuja como lista de filas con texto, para el menú desplegable del móvil.
 */
export default function UserMenu({ stacked = false }) {
  const { user, isGuest, isAdmin, configured } = useAuth()
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
          {error && (
            <p role="alert" className="px-3 text-xs text-brand-white">
              {error}
            </p>
          )}
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
            <MdLogin className="size-6" aria-hidden="true" />
          </button>
        </Tooltip>
        {error && (
          <p
            role="alert"
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-md border border-brand-gold bg-brand-black p-2 text-xs text-brand-white"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  const name = user.displayName || user.email || 'Mi cuenta'
  const avatar = user.photoURL ? (
    <img
      src={user.photoURL}
      alt=""
      referrerPolicy="no-referrer"
      className="size-9 rounded-full border border-brand-gold object-cover"
    />
  ) : (
    <MdAccountCircle className="size-9 text-brand-gold" aria-hidden="true" />
  )

  if (stacked) {
    return (
      <>
        <div className="flex items-center gap-3 px-3 py-2" title={name}>
          {avatar}
          <span className="min-w-0 truncate text-sm font-semibold text-brand-white">{name}</span>
        </div>
        <Link to="/mis-pedidos" className={menuRowClass}>
          <MdReceiptLong className="size-6 shrink-0" aria-hidden="true" />
          Mis pedidos
        </Link>
        {isAdmin && (
          <Link to="/admin" className={menuRowClass}>
            <MdAdminPanelSettings className="size-6 shrink-0" aria-hidden="true" />
            Administración
          </Link>
        )}
        <button type="button" onClick={signOutUser} className={menuRowClass}>
          <MdLogout className="size-6 shrink-0" aria-hidden="true" />
          Salir
        </button>
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2" title={name}>
        {avatar}
        <span className="hidden max-w-32 truncate text-sm font-semibold text-brand-white sm:inline">
          {name}
        </span>
      </div>
      <Tooltip label="Mis pedidos">
        <Link to="/mis-pedidos" aria-label="Mis pedidos" className={iconButtonClass}>
          <MdReceiptLong className="size-6" aria-hidden="true" />
        </Link>
      </Tooltip>
      {isAdmin && (
        <Tooltip label="Administración">
          <Link to="/admin" aria-label="Administración" className={iconButtonClass}>
            <MdAdminPanelSettings className="size-6" aria-hidden="true" />
          </Link>
        </Tooltip>
      )}
      <Tooltip label="Salir">
        <button type="button" onClick={signOutUser} aria-label="Salir" className={iconButtonClass}>
          <MdLogout className="size-6" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  )
}
