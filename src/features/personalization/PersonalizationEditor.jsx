import { useId } from 'react'
import Field from '../../components/Field.jsx'
import { inputClass } from '../../utils/ui.js'
import {
  NAME_MAX,
  previewNameSize,
  sanitizeName,
  sanitizeNumber,
  validatePersonalization,
} from './personalization.js'

/** Vista previa de la espalda de la camiseta con el nombre y el número escritos. */
export function BackPreview({ name, number }) {
  const shownName = name.trim() || 'NOMBRE'
  const shownNumber = number || '10'
  const empty = !name.trim() && !number
  return (
    <svg
      viewBox="0 0 200 220"
      role="img"
      aria-label={`Vista previa de la espalda: ${name.trim() || 'sin nombre'}, número ${number || 'sin número'}`}
      className="mx-auto w-full max-w-60"
    >
      <path
        d="M70 12 C82 26 118 26 130 12 L172 30 L196 78 L162 94 L156 80 L156 208 L44 208 L44 80 L38 94 L4 78 L28 30 Z"
        className="fill-brand-black stroke-brand-gold"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <text
        x="100"
        y="72"
        textAnchor="middle"
        fontWeight="800"
        fontSize={previewNameSize(shownName)}
        className={empty ? 'fill-brand-muted' : 'fill-brand-gold'}
      >
        {shownName}
      </text>
      <text
        x="100"
        y="150"
        textAnchor="middle"
        fontWeight="800"
        fontSize="72"
        className={empty ? 'fill-brand-muted' : 'fill-brand-gold'}
      >
        {shownNumber}
      </text>
    </svg>
  )
}

/**
 * Editor de personalización: casilla, competición, nombre, número, recargo y vista previa.
 * `value` = { enabled, name, number, competition }; `onChange` recibe el valor completo nuevo.
 * `competitions` = [{ id, name }] que ofrece la camisa (vacío = no se pregunta).
 */
export default function PersonalizationEditor({
  value,
  surcharge,
  onChange,
  formatPrice,
  competitions = [],
}) {
  const errorId = useId()
  const { errors } = validatePersonalization(value, { requireCompetition: competitions.length > 0 })
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-semibold">Personalización</legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="size-4 accent-[var(--accent-solid)]"
        />
        Personalizar con nombre y número
        {surcharge > 0 && (
          <span className="font-normal text-muted">(+{formatPrice(surcharge)})</span>
        )}
      </label>

      {value.enabled && (
        <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
          <div className="flex flex-col gap-3">
            {competitions.length > 0 && (
              <Field
                label="Competición"
                hint={errors.competition ?? 'De ella depende el estilo del nombre y número.'}
              >
                <select
                  value={value.competition}
                  onChange={(e) => set({ competition: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Elegir competición…</option>
                  {competitions.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Nombre" hint={`${value.name.trim().length}/${NAME_MAX} caracteres`}>
              <input
                value={value.name}
                onChange={(e) => set({ name: sanitizeName(e.target.value) })}
                maxLength={NAME_MAX}
                autoComplete="off"
                aria-describedby={errors.general ? errorId : undefined}
                className={`${inputClass} uppercase`}
                placeholder="Nombre"
              />
            </Field>
            <Field label="Número" hint="De 0 a 99">
              <input
                value={value.number}
                onChange={(e) => set({ number: sanitizeNumber(e.target.value) })}
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                aria-describedby={errors.general ? errorId : undefined}
                className={inputClass}
                placeholder="10"
              />
            </Field>
            {errors.general && (
              <p id={errorId} role="alert" className="text-sm text-danger">
                <span aria-hidden="true">⚠ </span>
                {errors.general}
              </p>
            )}
          </div>
          <BackPreview name={value.name} number={value.number} />
        </div>
      )}
    </fieldset>
  )
}
