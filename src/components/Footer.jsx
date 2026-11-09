/** Footer mínimo: eslogan y copyright. Negro fijo con borde dorado, igual que el navbar. */
export default function Footer() {
  return (
    // pb-12 deja libre el espacio de la navegación inferior en móvil
    <footer className="on-black border-t-2 border-brand-gold bg-brand-black pb-12 text-center md:pb-0">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold italic text-brand-gold">
          Tu equipo, tus colores, tu pasión.
        </p>
        <p className="text-xs text-brand-muted">© {new Date().getFullYear()} SuChemaFC</p>
      </div>
    </footer>
  )
}
