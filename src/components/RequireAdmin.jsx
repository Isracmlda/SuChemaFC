import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AccessDenied from '../pages/AccessDenied.jsx'

/** Protege las rutas /admin/*: exige sesión de Google y documento admins/{uid}. */
export default function RequireAdmin() {
  const { user, isAdmin, isGuest, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="py-16 text-center text-muted">
        Verificando acceso…
      </p>
    )
  }
  if (!configured || !user || isGuest) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!isAdmin) return <AccessDenied />
  return <Outlet />
}
