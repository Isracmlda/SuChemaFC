const TOKENS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['surface-3', 'bg-surface-3'],
  ['accent', 'bg-accent'],
  ['accent-solid', 'bg-accent-solid'],
  ['danger', 'bg-danger'],
  ['success', 'bg-success'],
]

/** Página interna de pruebas de diseño (solo en desarrollo): /__design */
export default function DesignTest() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Pruebas de diseño</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tokens</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOKENS.map(([name, cls]) => (
            <li key={name} className="rounded-md border border-border p-2 text-sm">
              <div className={`h-10 rounded ${cls} border border-border-strong`} />
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pares de texto</h2>
        <p className="rounded-md bg-bg p-3 text-fg">Texto principal sobre fondo</p>
        <p className="rounded-md bg-surface p-3 text-muted">Texto secundario sobre superficie</p>
        <p className="rounded-md bg-surface-2 p-3 text-accent">Texto dorado sobre superficie 2</p>
        <p className="rounded-md bg-accent-solid p-3 font-bold text-on-accent">
          Negro sobre dorado
        </p>
        <p className="rounded-md bg-brand-black p-3 text-brand-gold">Dorado sobre negro</p>
        <p className="rounded-md bg-brand-black p-3 text-brand-white">Blanco sobre negro</p>
        <p className="rounded-md bg-surface p-3 text-danger">Error: campo obligatorio</p>
        <p className="rounded-md bg-surface p-3 text-success">Éxito: pedido creado</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Controles</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 rounded-md bg-accent-solid px-4 font-bold text-on-accent hover:bg-accent-solid-hover"
          >
            Primario
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border-strong px-4 font-semibold"
          >
            Secundario
          </button>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-md bg-surface-3 px-4 font-semibold text-muted"
          >
            Deshabilitado
          </button>
        </div>
      </section>
    </div>
  )
}
