/**
 * Contenido que se despliega con animación de altura. Cerrado queda inerte (sin foco ni lectura
 * de pantalla). Con "reducir movimiento" activo aparece sin animar.
 */
export default function Collapsible({ open, id, children }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden p-1 -m-1">{children}</div>
    </div>
  )
}
