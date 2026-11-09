import { useState } from 'react'
import { MdAdd, MdClose, MdDelete, MdEdit } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import { deleteSizeChart, saveSizeChart, seedSizeCharts } from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { clearCatalogCache } from '../../../services/storefront.js'
import { errorMessage } from '../../../utils/errors.js'
import { nextOrder } from '../../../utils/tree.js'
import {
  actionStackClass,
  btnIcon,
  btnPrimary,
  btnSecondary,
  cardClass,
  inputClass,
} from '../../../utils/ui.js'
import { ChartTable } from '../../sizeChart/SizeGuide.jsx'
import {
  MEASURE_KINDS,
  SEED_CHARTS,
  addMeasure,
  addRow,
  emptyChart,
  kindsOf,
  removeMeasure,
  validateChart,
} from '../../sizeChart/chart.js'

const loadCharts = () => listCollection('sizeCharts')

export default function SizeChartsPage() {
  const dialog = useDialog()
  const { data, loading, error, reload } = useAsync(loadCharts)
  const [form, setForm] = useState(null) // null = cerrado
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const charts = [...data].sort((a, b) => a.order - b.order)
  const problem = form ? validateChart(form) : ''

  const setMeasure = (i, name) =>
    setForm((f) => ({ ...f, measures: f.measures.map((m, j) => (j === i ? name : m)) }))
  const setRow = (i, patch) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))
  const setValue = (i, k, value) =>
    setRow(i, { values: form.rows[i].values.map((v, j) => (j === k ? value : v)) })

  async function run(action, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      clearCatalogCache()
      setNotice({ type: 'ok', text: okText })
      return true
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    if (await run(() => saveSizeChart(form, nextOrder(charts)), 'Categoría guardada.')) {
      setForm(null)
      reload()
    }
  }

  async function handleDelete(chart) {
    const sure = await dialog.confirm({
      title: 'Eliminar categoría',
      message: `¿Eliminar la categoría "${chart.name}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!sure) return
    if (await run(() => deleteSizeChart(chart), 'Categoría eliminada.')) reload()
  }

  async function handleSeed() {
    if (
      charts.length > 0 &&
      !(await dialog.confirm({
        title: 'Cargar guías del proveedor',
        message:
          'Se cargarán las guías del proveedor. Si ya tienes una con el mismo nombre, se reemplaza por la del proveedor. ¿Continuar?',
        confirmLabel: 'Continuar',
      }))
    ) {
      return
    }
    if (
      await run(
        () => seedSizeCharts(SEED_CHARTS, charts),
        `Se cargaron ${SEED_CHARTS.length} guías de tallas del proveedor.`,
      )
    ) {
      reload()
    }
  }

  if (form) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">
          {form.id ? 'Editar categoría de tallas' : 'Nueva categoría de tallas'}
        </h2>
        <Field label="Nombre de la categoría" hint="Ej. Hombre, Mujer, Niño">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            maxLength={60}
          />
        </Field>
        <Field label="Nota (opcional)" hint="Se muestra bajo la tabla.">
          <input
            value={form.note ?? ''}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass}
            maxLength={200}
          />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">Medidas (en centímetros)</legend>
          <p className="text-sm text-muted">
            Las celdas aceptan un número (52) o un rango (48-50, 160/170). Las columnas de tipo
            «Texto» (peso, edad, código) no se convierten a pulgadas.
          </p>
          <div className="flex flex-wrap gap-2">
            {form.measures.map((m, i) => (
              <div key={i} className="flex items-end gap-1">
                <Field label={`Medida ${i + 1}`} className="w-44">
                  <input
                    value={m}
                    onChange={(e) => setMeasure(i, e.target.value)}
                    className={inputClass}
                    maxLength={40}
                  />
                  <select
                    aria-label={`Tipo de la medida ${i + 1}`}
                    value={kindsOf(form)[i]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        kinds: kindsOf(f).map((k, j) => (j === i ? e.target.value : k)),
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  >
                    {Object.entries(MEASURE_KINDS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  aria-label={`Quitar medida ${m || i + 1}`}
                  title="Quitar medida"
                  onClick={() => setForm(removeMeasure(form, i))}
                  className={btnIcon}
                >
                  <MdClose className="size-5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm(addMeasure(form))}
            className={`${btnSecondary} self-start`}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar medida
          </button>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">Tallas</legend>
          {form.rows.map((row, i) => (
            <div key={i} className={`${cardClass} flex flex-wrap items-end gap-3`}>
              <Field label="Talla" className="w-24">
                <input
                  value={row.size}
                  onChange={(e) => setRow(i, { size: e.target.value })}
                  className={inputClass}
                  maxLength={10}
                />
              </Field>
              {form.measures.map((m, k) => (
                <Field key={k} label={m || `Medida ${k + 1}`} className="w-28">
                  <input
                    inputMode="decimal"
                    value={row.values[k] ?? ''}
                    onChange={(e) => setValue(i, k, e.target.value)}
                    className={inputClass}
                  />
                </Field>
              ))}
              <button
                type="button"
                aria-label={`Quitar talla ${row.size || i + 1}`}
                title="Quitar talla"
                onClick={() => setForm({ ...form, rows: form.rows.filter((_, j) => j !== i) })}
                className={btnIcon}
              >
                <MdClose className="size-5" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm(addRow(form))}
            className={`${btnSecondary} self-start`}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar talla
          </button>
        </fieldset>

        {problem && <p className="text-sm text-muted">{problem}</p>}
        <Notice notice={notice} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy || Boolean(problem)} className={btnPrimary}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setForm(null)} className={btnSecondary}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={actionStackClass}>
        <button
          type="button"
          onClick={() => {
            setNotice(null)
            setForm(emptyChart())
          }}
          className={btnPrimary}
        >
          <MdAdd className="size-5" aria-hidden="true" />
          Nueva categoría
        </button>
        <button type="button" disabled={busy} onClick={handleSeed} className={btnSecondary}>
          Cargar guías del proveedor ({SEED_CHARTS.length})
        </button>
      </div>
      <Notice notice={notice} />
      {charts.length === 0 ? (
        <EmptyState>Aún no hay guía de tallas. Los clientes no verán el botón.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {charts.map((c) => (
            <li key={c.id} className={`${cardClass} flex flex-col gap-3`}>
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 font-semibold">{c.name}</p>
                <button
                  type="button"
                  aria-label={`Editar ${c.name}`}
                  title="Editar"
                  onClick={() => {
                    setNotice(null)
                    setForm(c)
                  }}
                  className={btnIcon}
                >
                  <MdEdit className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${c.name}`}
                  title="Eliminar"
                  disabled={busy}
                  onClick={() => handleDelete(c)}
                  className={btnIcon}
                >
                  <MdDelete className="size-5" aria-hidden="true" />
                </button>
              </div>
              <ChartTable chart={c} unit="cm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
