import { SIZES } from '../../../utils/constants.js'
import { chartSizes } from '../../sizeChart/chart.js'

/**
 * Selector de tallas visibles para camisa base y versiones. Las tallas salen siempre de la guía de
 * tallas asignada (`chart`): solo se puede marcar cuáles de ellas se ofrecen. Sin guía no hay nada
 * que elegir y se ofrecen las tallas que ya tenga la camisa (o las estándar, S a 4XL).
 */
export default function VisibleSizesEditor({
  value,
  onChange,
  inheritedSizes = SIZES,
  label = 'Tallas visibles',
  chart = null,
}) {
  if (!chart) {
    const shown = value?.length ? value : inheritedSizes
    return (
      <div className="flex flex-col gap-2">
        {label && <span className="text-sm font-semibold">{label}</span>}
        <p className="text-xs text-muted">
          Elige una guía de tallas para escoger las tallas que ofreces. Mientras no haya guía se
          ofrecen: <strong>{shown.join(', ')}</strong>
        </p>
      </div>
    )
  }

  const available = chartSizes(chart)
  const picked = value?.length ? available.filter((s) => value.includes(s)) : available
  const selected = picked.length > 0 ? picked : available

  const toggleChartSize = (size) => {
    const next = available.filter((s) =>
      s === size ? !selected.includes(s) : selected.includes(s),
    )
    if (next.length > 0) onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {label && <span className="text-sm font-semibold">{label}</span>}
      <p className="text-xs text-muted">
        Estas son las tallas de la guía «{chart.name}». Marca las que ofreces.
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map((size) => {
          const checked = selected.includes(size)
          return (
            <label
              key={size}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${
                checked
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border text-muted hover:border-border-strong'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleChartSize(size)}
                className="size-4 accent-[var(--accent-solid)]"
              />
              {size}
            </label>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(available)}
          className="text-xs text-accent underline self-center px-1 hover:text-accent-hover"
        >
          Marcar todas
        </button>
      </div>
      <p className="text-xs text-muted">
        Tallas visibles en la tienda: <strong>{selected.join(', ')}</strong>
      </p>
    </div>
  )
}
