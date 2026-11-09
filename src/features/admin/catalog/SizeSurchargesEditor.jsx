import Field from '../../../components/Field.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { SIZES } from '../../../utils/constants.js'
import { formatCRC } from '../../../utils/format.js'
import { btnSecondary } from '../../../utils/ui.js'

/**
 * Editor reutilizable de recargos por talla.
 */
export default function SizeSurchargesEditor({
  sizes = SIZES,
  surcharges = {},
  standardSizes = {},
  onChange,
  resetLabel = 'Volver a los recargos estándar',
}) {
  const surchargeOf = (size) => surcharges[size] ?? standardSizes[size] ?? 0
  const hasOverrides = sizes.some(
    (size) => size in surcharges && surcharges[size] !== (standardSizes[size] ?? 0),
  )

  function setSurcharge(size, value) {
    const next = { ...surcharges }
    const std = standardSizes[size] ?? 0
    if (value === std) {
      delete next[size]
    } else {
      next[size] = value
    }
    onChange(next)
  }

  function handleReset() {
    onChange({})
  }

  if (!sizes || sizes.length === 0) {
    return <p className="text-sm text-muted">No hay tallas configuradas para recargos.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sizes.map((size) => (
          <Field
            key={size}
            label={`Talla ${size} (₡)`}
            hint={
              size in surcharges ? `Estándar: ${formatCRC(standardSizes[size] ?? 0)}` : undefined
            }
          >
            <NumberInput value={surchargeOf(size)} onChange={(v) => setSurcharge(size, v)} />
          </Field>
        ))}
      </div>
      {hasOverrides && (
        <button type="button" onClick={handleReset} className={`${btnSecondary} self-start`}>
          {resetLabel}
        </button>
      )}
    </div>
  )
}
