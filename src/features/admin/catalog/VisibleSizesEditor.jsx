import { useState } from 'react'
import { MdAdd, MdClose } from 'react-icons/md'
import { SIZES } from '../../../utils/constants.js'
import { btnSecondary, inputClass } from '../../../utils/ui.js'
import { chartSizes } from '../../sizeChart/chart.js'
import { normalizeSizes, parseCustomSizes } from './productAdmin.js'

/**
 * Selector de tallas visibles para camisa base y versiones.
 * Permite marcar tallas estándar (S..4XL) y agregar tallas propias (16, 18...).
 * Con `chart` (la guía de tallas asignada) solo se pueden elegir las tallas que tiene esa guía.
 */
export default function VisibleSizesEditor({
  value,
  onChange,
  inheritedSizes = SIZES,
  allowInherit = false,
  label = 'Tallas visibles',
  chart = null,
}) {
  const [customText, setCustomText] = useState('')

  const isInherited = allowInherit && value == null
  const currentSizes = isInherited ? inheritedSizes : (value ?? SIZES)

  const customSizes = currentSizes.filter((s) => !SIZES.includes(s))

  function toggleStandard(size) {
    let next
    if (isInherited) {
      // Al modificar, se pasa de heredado a propio
      next = currentSizes.includes(size)
        ? currentSizes.filter((s) => s !== size)
        : insertStandard(currentSizes, size)
    } else {
      next = currentSizes.includes(size)
        ? currentSizes.filter((s) => s !== size)
        : insertStandard(currentSizes, size)
    }
    onChange(next)
  }

  function insertStandard(list, size) {
    // Inserta la talla estándar en su orden canónico relativo a las demás estándar
    const stdOrder = SIZES.filter((s) => s === size || list.includes(s))
    const customs = list.filter((s) => !SIZES.includes(s))
    return [...stdOrder, ...customs]
  }

  function addCustomSizes() {
    const parsed = parseCustomSizes(customText)
    if (parsed.length === 0) return
    const next = normalizeSizes([...currentSizes, ...parsed])
    onChange(next)
    setCustomText('')
  }

  function removeSize(sizeToRemove) {
    const next = currentSizes.filter((s) => s !== sizeToRemove)
    onChange(next)
  }

  function handleSelectAllStandard() {
    const customs = currentSizes.filter((s) => !SIZES.includes(s))
    onChange([...SIZES, ...customs])
  }

  function handleInheritToggle(inherit) {
    if (inherit) {
      onChange(undefined)
    } else {
      onChange([...inheritedSizes])
    }
  }

  if (chart) {
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

  return (
    <div className="flex flex-col gap-3">
      {label && <span className="text-sm font-semibold">{label}</span>}

      {allowInherit && (
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`inherit-sizes-${label}`}
              checked={isInherited}
              onChange={() => handleInheritToggle(true)}
              className="accent-[var(--accent-solid)]"
            />
            Usar las tallas de la camisa ({inheritedSizes.join(', ')})
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`inherit-sizes-${label}`}
              checked={!isInherited}
              onChange={() => handleInheritToggle(false)}
              className="accent-[var(--accent-solid)]"
            />
            Personalizar para esta versión
          </label>
        </div>
      )}

      {(!allowInherit || !isInherited) && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">Tallas estándar</span>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((size) => {
                const checked = currentSizes.includes(size)
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
                      onChange={() => toggleStandard(size)}
                      className="size-4 accent-[var(--accent-solid)]"
                    />
                    {size}
                  </label>
                )
              })}
              <button
                type="button"
                onClick={handleSelectAllStandard}
                className="text-xs text-accent underline self-center px-1 hover:text-accent-hover"
              >
                Marcar todas
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">
              Tallas propias (ej. 16, 18, 20 o tallas numéricas)
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Escribir tallas propias"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addCustomSizes()
                  }
                }}
                placeholder="16, 18, 20, 22..."
                maxLength={60}
                className={`${inputClass} min-w-0 max-w-xs`}
              />
              <button
                type="button"
                disabled={parseCustomSizes(customText).length === 0}
                onClick={addCustomSizes}
                className={btnSecondary}
              >
                <MdAdd className="size-5" aria-hidden="true" />
                Agregar
              </button>
            </div>
            {customSizes.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Tallas propias agregadas">
                {customSizes.map((size) => (
                  <li
                    key={size}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-accent bg-surface-2 ps-2.5 pe-1 text-sm font-semibold"
                  >
                    {size}
                    <button
                      type="button"
                      aria-label={`Quitar talla ${size}`}
                      onClick={() => removeSize(size)}
                      className="inline-flex size-7 items-center justify-center rounded hover:text-accent"
                    >
                      <MdClose className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted">
            Tallas visibles en la tienda: <strong>{currentSizes.join(', ') || '(ninguna)'}</strong>
          </p>
        </>
      )}
    </div>
  )
}
