import { useState } from 'react'
import { MdDownload } from 'react-icons/md'
import { Notice } from '../../../components/States.jsx'
import { listCollection } from '../../../services/db.js'
import { listAllOrders, loadCostData } from '../../../services/reports.js'
import { errorMessage } from '../../../utils/errors.js'
import { actionRowClass, btnSecondary, cardClass } from '../../../utils/ui.js'
import { backupName, catalogCsv, customersCsv, ordersCsv, toJson } from './exports.js'

function download(text, filename, type) {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Cada exportación: cómo leer los datos y cómo escribirlos en CSV y JSON. */
const EXPORTS = [
  {
    id: 'pedidos',
    title: 'Pedidos',
    text: 'Todos los pedidos (hasta 5000), con cliente, estado y pagos.',
    read: listAllOrders,
    csv: ordersCsv,
    json: (orders) => orders,
  },
  {
    id: 'clientes',
    title: 'Clientes',
    text: 'Clientes agrupados por teléfono a partir de los pedidos no cancelados.',
    read: listAllOrders,
    csv: customersCsv,
    json: (orders) =>
      orders.map(({ customer, id, total, createdAt }) => ({ id, customer, total, createdAt })),
  },
  {
    id: 'catalogo',
    title: 'Catálogo',
    text: 'Camisas con precio, costo privado y visibilidad.',
    read: async () => {
      const [products, { costs, variantCosts }] = await Promise.all([
        listCollection('products'),
        loadCostData(),
      ])
      return { products, costs, variantCosts }
    },
    csv: ({ products, costs, variantCosts }) => catalogCsv(products, costs, variantCosts),
    json: ({ products, costs, variantCosts }) =>
      products.map((p) => ({
        ...p,
        cost: costs[p.id] ?? null,
        ...(variantCosts[p.id] ? { variantCosts: variantCosts[p.id] } : {}),
      })),
  },
]

/** Lee los datos y descarga el archivo. */
async function exportFile(item, kind) {
  const data = await item.read()
  const now = Date.now()
  if (kind === 'csv') download(item.csv(data), backupName(item.id, 'csv', now), 'text/csv')
  else download(toJson(item.json(data)), backupName(item.id, 'json', now), 'application/json')
}

function ExportCard({ item }) {
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)

  async function run(kind) {
    setBusy(kind)
    setNotice(null)
    try {
      await exportFile(item, kind)
      setNotice({ type: 'ok', text: 'Archivo descargado.' })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy('')
    }
  }

  return (
    <li className={`${cardClass} flex flex-col gap-2`}>
      <h2 className="text-lg font-bold">{item.title}</h2>
      <p className="text-sm text-muted">{item.text}</p>
      <div className={actionRowClass}>
        {['csv', 'json'].map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run(kind)}
            className={btnSecondary}
          >
            <MdDownload className="size-5" aria-hidden="true" />
            {busy === kind ? 'Preparando…' : kind.toUpperCase()}
          </button>
        ))}
      </div>
      <Notice notice={notice} />
    </li>
  )
}

/** Respaldo manual de pedidos, clientes y catálogo (CSV para Excel y JSON completo). */
export default function BackupPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Respaldo</h1>
      <p className="text-sm text-muted">
        Descarga una copia de tus datos. Cada descarga lee los documentos de Firestore, así que
        úsala con moderación (cuota gratuita de lecturas).
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {EXPORTS.map((item) => (
          <ExportCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}
