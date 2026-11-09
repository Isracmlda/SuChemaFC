import { useState } from 'react'
import { MdAdd, MdDelete } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import { addExpense, deleteExpense, loadFinance } from '../../../services/finance.js'
import { formatDateTime, fromInputValue, toInputValue } from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, toInt } from '../../../utils/format.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { supplierLabel } from '../supplier/supplier.js'
import { EXPENSE_DESC_MAX, financeRows, groupFinance, totals, validateExpense } from './finance.js'

const VIEWS = [
  { id: 'order', label: 'Por pedido' },
  { id: 'month', label: 'Por mes' },
  { id: 'year', label: 'Por año' },
]

const today = () => toInputValue(Date.now()).slice(0, 10)
/** Solo fecha: se guarda al mediodía local para que ninguna zona horaria la corra de día. */
const dayToMs = (day) => fromInputValue(day ? `${day}T12:00` : '')

/** Verde si es ganancia, rojo si es pérdida. */
const tone = (n) => (n < 0 ? 'text-danger' : 'text-success')

function Money({ value }) {
  return <strong className={tone(value)}>{formatCRC(value)}</strong>
}

function Card({ label, value, hint, profit = false }) {
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-extrabold ${profit ? tone(value) : ''}`}>{formatCRC(value)}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function OrderRow({ r }) {
  return (
    <li className="flex flex-col gap-1 border-b border-border py-2 text-sm last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold">
          {r.supplier}{' '}
          <span className="font-normal text-muted">
            · {supplierLabel(r.status)} · {r.units} camisas
            {r.createdAt != null && ` · ${formatDateTime(r.createdAt)}`}
          </span>
        </span>
        <span>
          {r.profit < 0 ? 'Pérdida' : 'Ganancia'} hoy: <Money value={r.profit} />
        </span>
      </div>
      <p className="text-muted">
        Cobrado {formatCRC(r.collected)} de {formatCRC(r.expected)}
        {r.pending > 0 && ` (faltan ${formatCRC(r.pending)})`} · Costo {formatCRC(r.cost)} (camisas{' '}
        {formatCRC(r.productCost)} + importación {formatCRC(r.importCost)}) · Si se cobra todo:{' '}
        <Money value={r.projected} />
      </p>
      {r.missing > 0 && (
        <p className="text-xs text-muted">
          ⚠ {r.missing} camisa(s) cuyo pedido de cliente ya no existe: las cifras están incompletas.
        </p>
      )}
    </li>
  )
}

function PeriodTable({ groups, kind }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="py-2 pe-2 text-start">
              {kind === 'year' ? 'Año' : 'Mes'}
            </th>
            <th scope="col" className="px-2 text-end">
              Pedidos
            </th>
            <th scope="col" className="px-2 text-end">
              Cobrado
            </th>
            <th scope="col" className="px-2 text-end">
              Costos
            </th>
            <th scope="col" className="px-2 text-end">
              Secundarios
            </th>
            <th scope="col" className="ps-2 text-end">
              Ganancia
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-border">
              <th scope="row" className="py-2 pe-2 text-start font-semibold capitalize">
                {g.label}
              </th>
              <td className="px-2 text-end">{g.orders}</td>
              <td className="px-2 text-end">{formatCRC(g.collected)}</td>
              <td className="px-2 text-end">{formatCRC(g.cost)}</td>
              <td className="px-2 text-end">{formatCRC(g.extra)}</td>
              <td className="ps-2 text-end">
                <Money value={g.profit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Expenses({ expenses, onChanged }) {
  const dialog = useDialog()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [day, setDay] = useState(today())
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const form = { description, amount, date: dayToMs(day) }
  const problem = validateExpense(form)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await addExpense(form)
      setDescription('')
      setAmount(0)
      onChanged()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(expense) {
    const yes = await dialog.confirm({
      title: 'Eliminar costo secundario',
      message: `¿Eliminar «${expense.description}» (${formatCRC(expense.amount)})?`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    try {
      await deleteExpense(expense)
      onChanged()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={submit}
        className="grid gap-2 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-end"
      >
        <Field label="Insumo">
          <input
            value={description}
            maxLength={EXPENSE_DESC_MAX}
            placeholder="Papel de la impresora, bolsas…"
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Monto (₡)">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={amount || ''}
            placeholder="0"
            onChange={(e) => setAmount(toInt(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={`${inputClass} px-2`}
          />
        </Field>
        <button type="submit" disabled={busy || Boolean(problem)} className={btnPrimary}>
          <MdAdd className="size-5" aria-hidden="true" />
          Añadir
        </button>
      </form>
      <Notice notice={notice} />
      {expenses.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay costos secundarios.</p>
      ) : (
        <ul className="flex flex-col">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 border-b border-border py-1 text-sm last:border-b-0"
            >
              <span className="min-w-0">
                <span className="font-semibold">{e.description}</span>
                <span className="text-muted"> · {formatDateTime(e.date).split(',')[0]}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <strong>{formatCRC(e.amount)}</strong>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Eliminar ${e.description}`}
                  onClick={() => remove(e)}
                  className={btnIcon}
                >
                  <MdDelete className="size-5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Ganancias de los pedidos al proveedor: lo cobrado de cada uno frente a su costo (camisas +
 * importación), compendios por mes y por año, y los costos secundarios (insumos) que se restan.
 */
export default function FinanceSection() {
  const { data, loading, error, reload } = useAsync(loadFinance)
  const [view, setView] = useState('order')
  const [showExpenses, setShowExpenses] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const rows = financeRows(data.supplierOrders, data.orders)
  const all = totals(rows, data.expenses)

  return (
    <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="finance-title">
      <div>
        <h2 id="finance-title" className="text-lg font-bold">
          Ganancias por pedido al proveedor
        </h2>
        <p className="text-sm text-muted">
          Cobrado de los clientes menos lo que costó el pedido (camisas + importación) y los costos
          secundarios. Se actualiza solo conforme se cobran los saldos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card
          label="Cobrado"
          value={all.collected}
          hint={`de ${formatCRC(all.expected)} esperado`}
        />
        <Card label="Costos de pedidos" value={all.cost} hint={`${all.orders} pedidos`} />
        <Card label="Costos secundarios" value={all.extra} />
        <Card
          label={all.profit < 0 ? 'Pérdida hoy' : 'Ganancia hoy'}
          value={all.profit}
          profit
          hint={`Si se cobra todo: ${formatCRC(all.projected)}`}
        />
      </div>

      <div role="group" aria-label="Agrupar por" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={`${btnSecondary} ${view === v.id ? 'border-accent text-accent' : ''}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'order' ? (
        rows.length === 0 ? (
          <EmptyState>Aún no hay pedidos al proveedor.</EmptyState>
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <OrderRow key={r.id} r={r} />
            ))}
          </ul>
        )
      ) : (
        <PeriodTable groups={groupFinance(rows, data.expenses, view)} kind={view} />
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <button
          type="button"
          aria-expanded={showExpenses}
          onClick={() => setShowExpenses((v) => !v)}
          className={`${btnSecondary} self-start`}
        >
          {showExpenses ? 'Ocultar costos secundarios' : 'Costos secundarios (insumos)'}
        </button>
        {showExpenses && <Expenses expenses={data.expenses} onChanged={reload} />}
      </div>
    </section>
  )
}
