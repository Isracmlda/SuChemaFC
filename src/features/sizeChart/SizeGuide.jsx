import { useEffect, useRef, useState } from 'react'
import { MdClose, MdStraighten } from 'react-icons/md'
import { btnSecondary } from '../../utils/ui.js'
import { formatMeasure, kindsOf } from './chart.js'

/** Tabla de equivalencias de una categoría, en cm o pulgadas. */
export function ChartTable({ chart, unit }) {
  const kinds = kindsOf(chart)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-72 border-collapse text-sm">
        <caption className="sr-only">
          Tallas de {chart.name}, medidas en {unit === 'in' ? 'pulgadas' : 'centímetros'}
        </caption>
        <thead>
          <tr className="border-b-2 border-border-strong text-left">
            <th scope="col" className="p-2">
              Talla
            </th>
            {chart.measures.map((m, i) => (
              <th key={`${m}-${i}`} scope="col" className="p-2">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.size} className="border-b border-border">
              <th scope="row" className="p-2 text-left font-bold">
                {row.size}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className="p-2">
                  {formatMeasure(v, unit, kinds[i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Botón + ventana modal con la guía de tallas. Usa <dialog>, que ya maneja el foco y la tecla Esc.
 * `charts` viene del catálogo; si está vacío no muestra nada. `initialChartId` (opcional) es la categoría
 * con la que abre (la de la versión activa); si no existe, abre con la primera. Para que otra versión
 * reinicie la categoría, quien lo usa debe cambiar su `key`.
 */
export default function SizeGuide({ charts, initialChartId = '' }) {
  const dialogRef = useRef(null)
  const [selectedId, setSelectedId] = useState(initialChartId ?? '')
  const [unit, setUnit] = useState('cm')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!charts?.length) return null
  const sorted = [...charts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const chart = sorted.find((c) => c.id === selectedId) ?? sorted[0]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnSecondary} self-start`}>
        <MdStraighten className="size-5" aria-hidden="true" />
        Guía de tallas
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="size-guide-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="m-auto w-[min(92vw,40rem)] rounded-lg border border-border-strong bg-bg p-0 text-fg backdrop:bg-black/70"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <header className="flex items-center justify-between gap-3">
            <h2 id="size-guide-title" className="text-xl font-bold">
              Guía de tallas
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded-md border border-border-strong hover:border-accent"
            >
              <MdClose className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              aria-label="Categoría"
              value={chart.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border-strong bg-bg px-3 text-sm font-semibold text-fg hover:border-accent"
            >
              {sorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div
              role="group"
              aria-label="Unidad"
              className="flex overflow-hidden rounded-md border border-border-strong"
            >
              {['cm', 'in'].map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={`min-h-11 px-4 text-sm font-semibold ${
                    unit === u ? 'bg-accent-solid text-on-accent' : 'hover:text-accent'
                  }`}
                >
                  {u === 'cm' ? 'cm' : 'pulg.'}
                </button>
              ))}
            </div>
          </div>

          <ChartTable chart={chart} unit={unit} />
          {chart.note && <p className="text-sm text-muted">{chart.note}</p>}
        </div>
      </dialog>
    </>
  )
}
