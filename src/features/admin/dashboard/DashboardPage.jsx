import { useCallback, useState } from 'react'
import { ErrorState, Loading, EmptyState } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { listOrdersSince, loadCostData } from '../../../services/reports.js'
import { formatCRC } from '../../../utils/format.js'
import { btnSecondary, cardClass } from '../../../utils/ui.js'
import { ORDER_STATUS } from '../../orders/orderStatus.js'
import FinanceSection from '../finance/FinanceSection.jsx'
import { MAX_ORDERS, PERIODS, countStatuses, periodStart, summarize } from './stats.js'

function Stat({ label, value, hint }) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Report({ period }) {
  const load = useCallback(async () => {
    const [orders, { costs, variantCosts }] = await Promise.all([
      listOrdersSince(periodStart(period, Date.now())),
      loadCostData(),
    ])
    return { orders, summary: summarize(orders, costs, variantCosts) }
  }, [period])
  const { data, loading, error, reload } = useAsync(load)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { orders, summary: s } = data
  const counts = countStatuses(orders, Object.keys(ORDER_STATUS))
  const capped = orders.length >= MAX_ORDERS

  return (
    <div className="flex flex-col gap-5">
      {capped && (
        <p role="status" className="text-sm text-muted">
          Se muestran los {MAX_ORDERS} pedidos más recientes del periodo; elige uno más corto para
          ver cifras exactas.
        </p>
      )}

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pagos por revisar" value={counts.pago_pendiente_revision} />
        <Stat label="Pedidos en curso" value={s.inProgress} />
        <Stat
          label="Ventas confirmadas"
          value={formatCRC(s.sales.sold)}
          hint={`${s.sales.count} pedidos · promedio ${formatCRC(s.sales.average)}`}
        />
        <Stat
          label="Cobrado"
          value={formatCRC(s.sales.collected)}
          hint={`Saldo por cobrar ${formatCRC(s.sales.pending)}`}
        />
      </section>

      <section className={cardClass} aria-labelledby="by-status">
        <h2 id="by-status" className="mb-2 text-lg font-bold">
          Pedidos por estado
        </h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(ORDER_STATUS).map(([id, label]) => (
            <li key={id} className="flex justify-between gap-2 border-b border-border py-1">
              <span>{label}</span>
              <strong>{counts[id]}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass} aria-labelledby="margins">
        <h2 id="margins" className="mb-1 text-lg font-bold">
          Costos y márgenes
        </h2>
        <p className="mb-3 text-sm text-muted">
          Solo cuenta ventas confirmadas. El costo es el de la camisa base (parches y
          personalización no tienen costo registrado).
        </p>
        {s.products.length === 0 ? (
          <EmptyState>Aún no hay ventas confirmadas en este periodo.</EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm">
              Ingresos {formatCRC(s.margin.revenue)} · Costo {formatCRC(s.margin.cost)} ·{' '}
              <strong>
                Margen {formatCRC(s.margin.margin)}
                {s.margin.marginPct != null && ` (${s.margin.marginPct}%)`}
              </strong>
              {s.margin.withoutCost > 0 && (
                <span className="text-muted">
                  {' '}
                  · {s.margin.withoutCost} camisas sin costo registrado
                </span>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-start text-sm">
                <thead>
                  <tr className="border-b border-border-strong text-start">
                    <th scope="col" className="py-2 pe-2 text-start">
                      Camisa
                    </th>
                    <th scope="col" className="px-2 text-end">
                      Cant.
                    </th>
                    <th scope="col" className="px-2 text-end">
                      Ingresos
                    </th>
                    <th scope="col" className="px-2 text-end">
                      Costo
                    </th>
                    <th scope="col" className="px-2 text-end">
                      Margen
                    </th>
                    <th scope="col" className="ps-2 text-end">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.products.map((p) => (
                    <tr key={p.key} className="border-b border-border">
                      <th scope="row" className="py-2 pe-2 text-start font-semibold">
                        {p.name}
                      </th>
                      <td className="px-2 text-end">{p.qty}</td>
                      <td className="px-2 text-end">{formatCRC(p.revenue)}</td>
                      <td className="px-2 text-end">{p.cost == null ? '—' : formatCRC(p.cost)}</td>
                      <td className="px-2 text-end">
                        {p.margin == null ? '—' : formatCRC(p.margin)}
                      </td>
                      <td className="ps-2 text-end">
                        {p.marginPct == null ? '—' : `${p.marginPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** Dashboard con consultas acotadas por periodo (máx. 500 pedidos + los costos privados). */
export default function DashboardPage() {
  const [period, setPeriod] = useState('30d')
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Resumen del negocio</h1>
      <div role="group" aria-label="Periodo" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={`${btnSecondary} ${period === p.id ? 'border-accent text-accent' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Report key={period} period={period} />
      <FinanceSection />
    </section>
  )
}
