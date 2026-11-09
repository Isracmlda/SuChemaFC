import { useState } from 'react'
import { MdAdd } from 'react-icons/md'
import Collapsible from '../../../components/Collapsible.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { MAX_SECTION_DEPTH, SECTION_NAME_MAX, sectionDepth } from '../../../utils/tree.js'
import { btnSecondary, inputClass } from '../../../utils/ui.js'
import { sectionPath } from '../../catalog/search.js'

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

/**
 * Selector de secciones en cascada: primero las principales y, al elegir una, se despliegan sus
 * subsecciones (hasta 5 niveles). `value` es el ID de la sección más profunda elegida ('' = ninguna).
 * Con `onCreate({ name, parentId })` permite crear una sección nueva dentro de la elegida;
 * debe devolver la sección creada (ya con `id`) y agregarla a `sections`. El panel de creación
 * se despliega con `creating`; quien lo usa pone el botón que lo abre (`createPanelId` es el id
 * del panel, para `aria-controls`).
 */
export default function SectionSelector({
  sections,
  value,
  onChange,
  rootLabel = 'Elegir sección principal…',
  onCreate,
  creating = false,
  createPanelId,
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const path = value ? sectionPath(sections, value) : []
  const levels = []
  for (let i = 0; i <= path.length && i < MAX_SECTION_DEPTH; i += 1) {
    const parentId = i === 0 ? null : path[i - 1].id
    const options = sections.filter((s) => (s.parentId ?? null) === parentId).sort(byOrder)
    if (options.length === 0) break
    levels.push({ i, options, selected: path[i]?.id ?? '' })
  }

  const parent = path[path.length - 1] ?? null
  const atLimit = parent ? sectionDepth(sections, parent.id) >= MAX_SECTION_DEPTH : false

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await onCreate({ name, parentId: parent?.id ?? null })
      setName('')
      onChange(created.id)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {levels.length === 0 && <p className="text-sm text-muted">Aún no hay secciones.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {levels.map(({ i, options, selected }) => (
          <select
            key={i}
            aria-label={i === 0 ? 'Sección principal' : `Subsección de nivel ${i + 1}`}
            value={selected}
            onChange={(e) => onChange(e.target.value || (i === 0 ? '' : path[i - 1].id))}
            className={inputClass}
          >
            <option value="">{i === 0 ? rootLabel : 'Elegir subsección (opcional)…'}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.visible === false ? ' (oculta)' : ''}
              </option>
            ))}
          </select>
        ))}
      </div>

      {onCreate && (
        <Collapsible open={creating} id={createPanelId}>
          {atLimit ? (
            <p className="text-sm text-muted">
              «{parent.name}» ya está en el nivel {MAX_SECTION_DEPTH} (el máximo): no admite más
              subsecciones.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {parent ? `Crear subsección dentro de «${parent.name}»` : 'Crear sección principal'}
              </span>
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Nombre de la sección nueva"
                  value={name}
                  maxLength={SECTION_NAME_MAX}
                  placeholder="Nombre de la sección nueva"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      create()
                    }
                  }}
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={create}
                  className={btnSecondary}
                >
                  <MdAdd className="size-5" aria-hidden="true" />
                  {busy ? 'Creando…' : 'Crear'}
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          )}
        </Collapsible>
      )}
    </div>
  )
}
