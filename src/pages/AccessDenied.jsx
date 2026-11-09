import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

export default function AccessDenied() {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold">Acceso denegado</h1>
      <p className="max-w-md text-muted">
        Tu cuenta no tiene permisos de administración. Si crees que es un error, contacta al
        responsable de la tienda.
      </p>
      <Link to="/" className="font-semibold text-accent underline">
        Volver al inicio
      </Link>
    </section>
  )
}
