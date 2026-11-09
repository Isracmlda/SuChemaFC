import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import googleG from '../assets/google-g.svg'
import Logo from '../components/Logo.jsx'
import { Notice } from '../components/States.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { authErrorMessage, signInWithGoogle } from '../services/auth.js'

/**
 * Página de inicio de sesión. Está OCULTA a propósito: ningún enlace la muestra, porque hoy
 * el ícono de Ingresar del navbar abre Google directamente. Se conserva para cuando se
 * añadan otros métodos de acceso (correo, teléfono, etc.).
 */
export default function Login() {
  const { user, isGuest, loading, configured } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const redirectTo = location.state?.from ?? '/'

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && user && !isGuest) return <Navigate to={redirectTo} replace />

  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-5 py-10 text-center">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <p className="text-muted">
        Con tu cuenta de Google puedes ver tus pedidos, guardar tu lista de deseos y dejar reseñas.
      </p>

      {!configured && (
        <p role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">
          Error de configuración: falta el archivo .env con los datos de Firebase.
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy || loading || !configured}
        className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-md bg-accent-solid px-6 font-bold text-on-accent hover:bg-accent-solid-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted"
      >
        <img src={googleG} alt="" className="size-6 rounded-full bg-brand-white p-0.5" />
        {busy ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>

      <Notice notice={error ? { type: 'error', text: error } : null} />
    </section>
  )
}
