import { Link } from 'react-router-dom'

/** Página provisional para rutas que se construyen en subtareas posteriores. */
export default function Placeholder({ title }) {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">Esta sección estará disponible pronto.</p>
      <Link to="/" className="font-semibold text-accent underline">
        Volver al inicio
      </Link>
    </section>
  )
}
