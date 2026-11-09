import { useState } from 'react'
import { MdAdd, MdDelete, MdEdit, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import CheckList from '../../../components/CheckList.jsx'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { listCollection } from '../../../services/db.js'
import {
  deleteCoupon,
  listCoupons,
  saveCoupon,
  setCouponActive,
} from '../../../services/promotions.js'
import { formatDateTime, fromInputValue, toInputValue } from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, normalizeText, toInt } from '../../../utils/format.js'
import { buildTree, flattenTree } from '../../../utils/tree.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import {
  COUPON_SCOPES,
  COUPON_TYPES,
  couponProblem,
  normalizeCode,
  validateCouponForm,
} from '../../pricing/coupon.js'

const load = async () => {
  const [coupons, sections, products] = await Promise.all([
    listCoupons(),
    listCollection('sections'),
    listCollection('products'),
  ])
  return { coupons, sections, products: products.filter((p) => !p.deleted) }
}

const NEW_COUPON = {
  code: '',
  type: 'percent',
  value: 10,
  scope: { type: 'all', ids: [] },
  minSubtotal: 0,
  maxUses: 0,
  startsAt: null,
  endsAt: null,
  active: true,
}

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

const describeValue = (c) => (c.type === 'percent' ? `${c.value}%` : formatCRC(c.value))
const SCOPE_TEXT = {
  all: 'toda la tienda',
  sections: 'secciones elegidas',
  products: 'camisas elegidas',
}

function CouponForm({ data, initial, isNew, onDone }) {
  const [f, setF] = useState(initial)
  const [productSearch, setProductSearch] = useState('')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const problem = validateCouponForm(f)
  const sectionItems = flattenTree(buildTree(data.sections)).map((s) => ({
    id: s.id,
    label: `${'— '.repeat(s.depth)}${s.name}`,
  }))
  const q = normalizeText(productSearch)
  const productItems = data.products
    .filter((p) => f.scope.ids.includes(p.id) || !q || normalizeText(p.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, 60)
    .map((p) => ({ id: p.id, label: p.name }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await saveCoupon({ ...f, code: normalizeCode(f.code) }, isNew)
      onDone()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{isNew ? 'Nuevo cupón' : `Editar cupón ${f.code}`}</h2>

      <section className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <Field
          label="Código"
          hint={isNew ? 'Letras, números, guion. Se guarda en mayúsculas.' : 'No se puede cambiar.'}
        >
          <input
            required
            readOnly={!isNew}
            value={f.code}
            onChange={(e) => setF({ ...f, code: normalizeCode(e.target.value) })}
            autoComplete="off"
            className={`${inputClass} uppercase`}
          />
        </Field>
        <Field label="Tipo de descuento">
          <select
            value={f.type}
            onChange={(e) => setF({ ...f, type: e.target.value })}
            className={inputClass}
          >
            {COUPON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.type === 'percent' ? 'Porcentaje (1 a 100)' : 'Monto (₡)'}>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={f.value}
            onChange={(e) => setF({ ...f, value: toInt(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Compra mínima (₡)" hint="0 = sin mínimo.">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={f.minSubtotal}
            onChange={(e) => setF({ ...f, minSubtotal: toInt(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Vale desde">
          <input
            type="datetime-local"
            required
            value={toInputValue(f.startsAt)}
            onChange={(e) => setF({ ...f, startsAt: fromInputValue(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Vale hasta">
          <input
            type="datetime-local"
            required
            value={toInputValue(f.endsAt)}
            onChange={(e) => setF({ ...f, endsAt: fromInputValue(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Límite de usos" hint="0 = ilimitado. Cuenta pedidos, no personas.">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={f.maxUses}
            onChange={(e) => setF({ ...f, maxUses: toInt(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
            className="size-4 accent-[var(--accent-solid)]"
          />
          Activo
        </label>
      </section>

      <section className={`${cardClass} flex flex-col gap-3`}>
        <Field label="Aplica a">
          <select
            value={f.scope.type}
            onChange={(e) => setF({ ...f, scope: { type: e.target.value, ids: [] } })}
            className={inputClass}
          >
            {COUPON_SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        {f.scope.type === 'sections' && (
          <CheckList
            legend="Secciones (incluyen sus subsecciones)"
            items={sectionItems}
            selected={f.scope.ids}
            onToggle={(id) => setF({ ...f, scope: { ...f.scope, ids: toggle(f.scope.ids, id) } })}
            empty="Primero crea secciones."
          />
        )}
        {f.scope.type === 'products' && (
          <>
            <Field label="Buscar camisa">
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={inputClass}
              />
            </Field>
            <CheckList
              legend={`Camisas (${f.scope.ids.length} elegidas)`}
              items={productItems}
              selected={f.scope.ids}
              onToggle={(id) => setF({ ...f, scope: { ...f.scope, ids: toggle(f.scope.ids, id) } })}
              empty="No hay camisas que coincidan."
            />
          </>
        )}
      </section>

      {problem && <p className="text-sm text-muted">{problem}</p>}
      <Notice notice={notice} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || Boolean(problem)} className={btnPrimary}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => onDone(false)} className={btnSecondary}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function CouponsPage() {
  const { data, loading, error, reload } = useAsync(load)
  const [form, setForm] = useState(null) // { initial, isNew }
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  async function act(action, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      setNotice({ type: 'ok', text: okText })
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  if (form) {
    return (
      <CouponForm
        data={data}
        initial={form.initial}
        isNew={form.isNew}
        onDone={(saved = true) => {
          setForm(null)
          if (saved) {
            setNotice({ type: 'ok', text: 'Cupón guardado.' })
            reload()
          }
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          setNotice(null)
          setForm({ initial: NEW_COUPON, isNew: true })
        }}
        className={`${btnPrimary} self-start`}
      >
        <MdAdd className="size-5" aria-hidden="true" />
        Nuevo cupón
      </button>
      <Notice notice={notice} />
      {data.coupons.length === 0 ? (
        <EmptyState>Aún no hay cupones.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.coupons.map((c) => {
            const problem = couponProblem(c)
            return (
              <li key={c.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.id} · {describeValue(c)} de descuento
                  </p>
                  <p className="text-sm text-muted">
                    {SCOPE_TEXT[c.scope.type]}
                    {c.minSubtotal > 0 && ` · mínimo ${formatCRC(c.minSubtotal)}`}
                    {' · '}
                    {c.maxUses > 0
                      ? `${c.usedCount ?? 0} de ${c.maxUses} usos`
                      : `${c.usedCount ?? 0} usos`}
                    {c.startsAt &&
                      c.endsAt &&
                      ` · ${formatDateTime(c.startsAt)} a ${formatDateTime(c.endsAt)}`}
                  </p>
                  <p className={`text-sm font-semibold ${problem ? 'text-muted' : 'text-success'}`}>
                    {problem ? `No disponible: ${problem}` : 'Vigente'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Editar ${c.id}`}
                  title="Editar"
                  onClick={() => {
                    setNotice(null)
                    setForm({ initial: { ...c, code: c.id }, isNew: false })
                  }}
                  className={btnIcon}
                >
                  <MdEdit className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={c.active ? `Desactivar ${c.id}` : `Activar ${c.id}`}
                  title={c.active ? 'Desactivar' : 'Activar'}
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => setCouponActive(c, !c.active),
                      c.active ? 'Desactivado.' : 'Activado.',
                    )
                  }
                  className={btnIcon}
                >
                  {c.active ? (
                    <MdVisibility className="size-5" aria-hidden="true" />
                  ) : (
                    <MdVisibilityOff className="size-5" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${c.id}`}
                  title="Eliminar"
                  disabled={busy}
                  onClick={() =>
                    window.confirm(`¿Eliminar el cupón ${c.id}?`) &&
                    act(() => deleteCoupon(c), 'Cupón eliminado.')
                  }
                  className={btnIcon}
                >
                  <MdDelete className="size-5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
