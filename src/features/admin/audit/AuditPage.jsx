import { useCallback, useState } from 'react'
import Field from '../../../components/Field.jsx'
import FilterPanel from '../../../components/FilterPanel.jsx'
import { EmptyState, ErrorState, Loading } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { listAudit } from '../../../services/reports.js'
import { formatDateTime, toMillis } from '../../../utils/dates.js'
import { btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import {
  ACTION_LABEL,
  AUDIT_ACTIONS,
  distinct,
  endOfDay,
  filterAudit,
  startOfDay,
} from './audit.js'

const PAGE = 100
const NO_FILTERS = { action: '', collection: '', query: '', from: '', to: '' }

/** Visor de la bitácora de auditoría: las últimas 100 entradas, con "Cargar anteriores". */
export default function AuditPage() {
  const first = useCallback(() => listAudit(null, PAGE), [])
  const { data, loading, error, reload } = useAsync(first)
  const [older, setOlder] = useState([])
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [filters, setFilters] = useState(NO_FILTERS)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const entries = [...data, ...older]
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const shown = filterAudit(entries, {
    action: filters.action,
    collection: filters.collection,
    query: filters.query,
    from: startOfDay(filters.from),
    to: endOfDay(filters.to),
  })

  async function loadOlder() {
    setBusy(true)
    setLoadError(null)
    try {
      const last = toMillis(entries.at(-1)?.createdAt)
      const page = await listAudit(last, PAGE)
      setOlder((o) => [...o, ...page])
      if (page.length < PAGE) setMore(false)
    } catch (e) {
      setLoadError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Bitácora</h1>
      <FilterPanel
        gridClass="sm:grid-cols-2 lg:grid-cols-5"
        active={Object.values(filters).some(Boolean)}
        onClear={() => setFilters(NO_FILTERS)}
        search={
          <Field label="Buscar">
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Resumen, ID o admin"
              className={inputClass}
            />
          </Field>
        }
      >
        <Field label="Acción">
          <select
            value={filters.action}
            onChange={(e) => set({ action: e.target.value })}
            className={inputClass}
          >
            <option value="">Todas</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Colección">
          <select
            value={filters.collection}
            onChange={(e) => set({ collection: e.target.value })}
            className={inputClass}
          >
            <option value="">Todas</option>
            {distinct(entries, 'collection').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Desde">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Hasta">
          <input
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            className={inputClass}
          />
        </Field>
      </FilterPanel>

      <p role="status" className="text-sm text-muted">
        {shown.length} de {entries.length} entradas cargadas.
      </p>
      {shown.length === 0 ? (
        <EmptyState>No hay entradas con esos filtros.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((e) => (
            <li key={e.id} className={`${cardClass} flex flex-col gap-1`}>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{ACTION_LABEL[e.action] ?? e.action}</strong>
                <span className="text-muted">{e.collection}</span>
                <span className="ms-auto text-muted">{formatDateTime(toMillis(e.createdAt))}</span>
              </p>
              {e.summary && <p>{e.summary}</p>}
              <p className="break-all text-xs text-muted">
                {e.docId && `ID ${e.docId} · `}Admin {e.actorUid}
              </p>
            </li>
          ))}
        </ul>
      )}
      {loadError && <ErrorState error={loadError} onRetry={loadOlder} />}
      {more && data.length >= PAGE && (
        <button
          type="button"
          disabled={busy}
          onClick={loadOlder}
          className={`${btnSecondary} self-center`}
        >
          {busy ? 'Cargando…' : 'Cargar anteriores'}
        </button>
      )}
    </section>
  )
}
