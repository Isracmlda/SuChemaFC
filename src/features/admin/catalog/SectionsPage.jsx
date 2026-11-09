import { useState } from 'react'
import {
  MdArrowDownward,
  MdArrowUpward,
  MdAdd,
  MdChevronRight,
  MdDelete,
  MdEdit,
  MdExpandMore,
  MdPlaylistAdd,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import Field from '../../../components/Field.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import {
  createSection,
  deleteSection,
  importSections,
  saveSection,
  setSectionVisible,
  swapSectionOrder,
} from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { clearCatalogCache } from '../../../services/storefront.js'
import {
  MAX_SECTION_DEPTH,
  SECTION_NAME_MAX,
  buildTree,
  flattenVisible,
  sectionDepth,
} from '../../../utils/tree.js'
import {
  actionRowClass,
  btnIcon,
  btnPrimary,
  btnSecondary,
  cardClass,
  inputClass,
} from '../../../utils/ui.js'
import { sectionPath } from '../../catalog/search.js'
import SectionSelector from './SectionSelector.jsx'
import { buildImportPlan, MAX_IMPORT_SECTIONS, parseSectionPaste } from './sectionImport.js'

const loadSections = () => listCollection('sections')

const EXAMPLE =
  'Liga Española\tFC Barcelona\tVisita\nLiga Española\tFC Barcelona\tLocal\nPremier League'

/** Carga masiva: pegar desde Excel, elegir dónde van y previsualizar antes de crear. */
function BulkImport({ sections, onDone, onClose }) {
  const [parentId, setParentId] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const parsed = parseSectionPaste(text)
  const plan = buildImportPlan(sections, parentId || null, parsed.rows)
  const problems = [...parsed.errors, ...plan.errors].sort((a, b) => a.line - b.line)
  const parentName = parentId
    ? sectionPath(sections, parentId)
        .map((s) => s.name)
        .join(' › ')
    : 'Secciones principales'

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await importSections(plan.created)
      onDone(
        `Se crearon ${plan.created.length} secciones${plan.reused ? ` (${plan.reused} ya existían y se respetaron)` : ''}.`,
      )
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="bulk-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bulk-title" className="text-lg font-bold">
          Carga masiva de secciones
        </h2>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cerrar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-semibold">1. ¿Dónde se van a cargar?</p>
        <SectionSelector
          sections={sections}
          value={parentId}
          onChange={setParentId}
          rootLabel="(Secciones principales)"
        />
        <p className="text-sm text-muted">
          Destino: <strong>{parentName}</strong>
        </p>
      </div>

      <Field
        label="2. Pega aquí desde Excel o una tabla"
        hint={`Cada fila es una ruta y cada celda un nivel (Liga | Equipo | Visita…). Una sola columna agrega secciones del mismo nivel. Máximo ${MAX_SECTION_DEPTH} niveles en total y ${MAX_IMPORT_SECTIONS} secciones nuevas por carga. También sirve separar con «>».`}
      >
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          className={`${inputClass} py-2 font-mono text-sm`}
          spellCheck={false}
        />
      </Field>

      {text.trim() && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="font-semibold">3. Previsualización</p>
          <p className="text-sm text-muted">
            {plan.created.length} secciones nuevas
            {plan.reused > 0 && ` · ${plan.reused} ya existen (no se duplican)`}
            {problems.length > 0 && ` · ${problems.length} filas con problemas (se omiten)`}
          </p>

          {problems.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-danger p-3 text-sm text-danger">
              {problems.map((p, i) => (
                <li key={i}>
                  Fila {p.line}: {p.message}
                </li>
              ))}
            </ul>
          )}

          {plan.preview.length > 0 && (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-border p-3 text-sm">
              {plan.preview.map((n) => (
                <li
                  key={n.key}
                  style={{ paddingLeft: `${(n.depth - plan.baseDepth - 1) * 1.25}rem` }}
                  className="flex items-center gap-2"
                >
                  <span className={n.isNew ? 'font-semibold' : 'text-muted'}>{n.name}</span>
                  <span
                    className={`rounded px-1.5 text-xs ${n.isNew ? 'bg-accent-solid text-on-accent' : 'border border-border text-muted'}`}
                  >
                    {n.isNew ? 'nueva' : 'ya existe'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <Notice notice={{ type: 'error', text: error }} />}
      <div className={actionRowClass}>
        <button
          type="button"
          disabled={busy || plan.created.length === 0}
          onClick={confirm}
          className={btnPrimary}
        >
          <MdPlaylistAdd className="size-5" aria-hidden="true" />
          {busy ? 'Creando…' : `Crear ${plan.created.length} secciones`}
        </button>
        <button type="button" disabled={busy} onClick={() => setText('')} className={btnSecondary}>
          Limpiar
        </button>
      </div>
    </section>
  )
}

export default function SectionsPage() {
  const dialog = useDialog()
  const { data, loading, error, reload } = useAsync(loadSections)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [editing, setEditing] = useState(null) // { id, name }
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [showBulk, setShowBulk] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const tree = buildTree(data)
  const rows = flattenVisible(tree, expanded)
  const allIds = data.filter((s) => data.some((c) => c.parentId === s.id)).map((s) => s.id)

  const toggleOpen = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function run(action, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      clearCatalogCache()
      setNotice({ type: 'ok', text: okText })
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(event) {
    event.preventDefault()
    run(async () => {
      const created = await createSection({ name, parentId: parentId || null }, data)
      setName('')
      // Se abre la rama para que la nueva sección se vea enseguida.
      if (created.parentId) setExpanded((prev) => new Set(prev).add(created.parentId))
    }, 'Sección creada.')
  }

  function handleRename(section) {
    if (!editing?.name.trim()) return
    run(async () => {
      await saveSection({ ...section, name: editing.name })
      setEditing(null)
    }, 'Sección renombrada.')
  }

  function move(section, direction) {
    const siblings = data
      .filter((s) => (s.parentId ?? null) === (section.parentId ?? null))
      .sort((a, b) => a.order - b.order)
    const other = siblings[siblings.findIndex((s) => s.id === section.id) + direction]
    if (other) run(() => swapSectionOrder(section, other), 'Orden actualizado.')
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className={`${cardClass} flex flex-col gap-3`}>
        <Field label="Nueva sección" hint={`Hasta ${MAX_SECTION_DEPTH} niveles de anidación.`}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Ej. Selecciones"
            maxLength={SECTION_NAME_MAX}
          />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Dentro de</span>
          <SectionSelector
            sections={data}
            value={parentId}
            onChange={setParentId}
            rootLabel="(Sección principal)"
          />
        </div>
        <div className={actionRowClass}>
          <button
            type="submit"
            disabled={busy || !name.trim() || sectionDepth(data, parentId) >= MAX_SECTION_DEPTH}
            className={btnPrimary}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar
          </button>
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className={btnSecondary}
            aria-expanded={showBulk}
          >
            <MdPlaylistAdd className="size-5" aria-hidden="true" />
            Carga masiva
          </button>
        </div>
      </form>

      {showBulk && (
        <BulkImport
          sections={data}
          onClose={() => setShowBulk(false)}
          onDone={(text) => {
            clearCatalogCache()
            setNotice({ type: 'ok', text })
            setShowBulk(false)
            reload()
          }}
        />
      )}

      <Notice notice={notice} />

      {rows.length === 0 ? (
        <EmptyState>Aún no hay secciones. Crea la primera arriba.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(new Set(allIds))}
              className={btnSecondary}
            >
              Abrir todo
            </button>
            <button type="button" onClick={() => setExpanded(new Set())} className={btnSecondary}>
              Cerrar todo
            </button>
            <span className="text-sm text-muted">{data.length} secciones en total</span>
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((s) => {
              const siblings = data
                .filter((o) => (o.parentId ?? null) === (s.parentId ?? null))
                .sort((a, b) => a.order - b.order)
              const index = siblings.findIndex((o) => o.id === s.id)
              const open = expanded.has(s.id)
              return (
                <li
                  key={s.id}
                  style={{ marginLeft: `${s.depth * 1.25}rem` }}
                  className={`${cardClass} flex flex-wrap items-center gap-2 ${s.visible ? '' : 'opacity-60'}`}
                >
                  {s.hasChildren ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? 'Cerrar' : 'Abrir'} ${s.name}`}
                      title={open ? 'Cerrar' : 'Abrir'}
                      onClick={() => toggleOpen(s.id)}
                      className={btnIcon}
                    >
                      {open ? (
                        <MdExpandMore className="size-5" aria-hidden="true" />
                      ) : (
                        <MdChevronRight className="size-5" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className="size-10 shrink-0" aria-hidden="true" />
                  )}
                  {editing?.id === s.id ? (
                    <>
                      <input
                        aria-label="Nuevo nombre"
                        value={editing.name}
                        onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                        className={`${inputClass} min-w-0 flex-1`}
                        maxLength={SECTION_NAME_MAX}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRename(s)}
                        className={btnPrimary}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className={btnSecondary}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 font-semibold">
                        {s.name}
                        {s.hasChildren && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            ({s.children.length})
                          </span>
                        )}
                        {!s.visible && <span className="ml-2 text-xs text-muted">(oculta)</span>}
                      </span>
                      <button
                        type="button"
                        aria-label={`Subir ${s.name}`}
                        title="Subir"
                        disabled={busy || index === 0}
                        onClick={() => move(s, -1)}
                        className={btnIcon}
                      >
                        <MdArrowUpward className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Bajar ${s.name}`}
                        title="Bajar"
                        disabled={busy || index === siblings.length - 1}
                        onClick={() => move(s, 1)}
                        className={btnIcon}
                      >
                        <MdArrowDownward className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Renombrar ${s.name}`}
                        title="Renombrar"
                        onClick={() => setEditing({ id: s.id, name: s.name })}
                        className={btnIcon}
                      >
                        <MdEdit className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={s.visible ? `Ocultar ${s.name}` : `Mostrar ${s.name}`}
                        title={s.visible ? 'Ocultar' : 'Mostrar'}
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => setSectionVisible(s, !s.visible),
                            s.visible ? 'Sección oculta.' : 'Sección visible.',
                          )
                        }
                        className={btnIcon}
                      >
                        {s.visible ? (
                          <MdVisibility className="size-5" aria-hidden="true" />
                        ) : (
                          <MdVisibilityOff className="size-5" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar ${s.name}`}
                        title="Eliminar"
                        disabled={busy}
                        onClick={async () => {
                          const sure = await dialog.confirm({
                            title: 'Eliminar sección',
                            message: `¿Eliminar la sección "${s.name}"?`,
                            confirmLabel: 'Eliminar',
                            danger: true,
                          })
                          if (sure) run(() => deleteSection(s, data), 'Sección eliminada.')
                        }}
                        className={btnIcon}
                      >
                        <MdDelete className="size-5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
