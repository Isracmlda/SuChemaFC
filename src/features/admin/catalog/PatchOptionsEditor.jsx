import DriveImage from '../../../components/DriveImage.jsx'
import { formatCRC } from '../../../utils/format.js'
import { isOptionDisabled, setOptionEnabled } from '../../catalog/patches.js'

/**
 * Activa o desactiva, para esta camisa, cada opción de los grupos de parches que usa. Una opción
 * desactivada no se ofrece al cliente (el grupo del catálogo no cambia). Se guarda en
 * `disabledPatches` por nombre de opción.
 */
export default function PatchOptionsEditor({ groups, disabledPatches, onChange }) {
  const withOptions = groups.filter((g) => (g.options ?? []).length > 0)
  if (withOptions.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Desmarca las opciones que esta camisa no ofrece. Los demás parches del grupo se mantienen.
      </p>
      {withOptions.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">{group.name}</legend>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option, i) => {
              const enabled = !isOptionDisabled({ disabledPatches }, group.id, option)
              return (
                <label
                  key={i}
                  className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs ${
                    enabled ? 'border-accent bg-surface-2' : 'border-border-strong text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      onChange(
                        setOptionEnabled(disabledPatches, group.id, option, e.target.checked),
                      )
                    }
                    className="size-3.5 accent-[var(--accent-solid)]"
                  />
                  {option.image && (
                    <DriveImage
                      id={option.image}
                      size={64}
                      className="size-5 shrink-0 rounded-sm"
                    />
                  )}
                  <span className={enabled ? '' : 'line-through'}>{option.name}</span>
                  <span className="text-muted">+{formatCRC(option.price)}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
