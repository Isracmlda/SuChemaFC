import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

export default function NotFound() {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-muted">La dirección que buscas no existe.</p>
      <Link to="/" className="font-semibold text-accent underline">
        Volver al inicio
      </Link>
    </section>
  )
}
