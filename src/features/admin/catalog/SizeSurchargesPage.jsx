import { useState } from 'react'
import Field from '../../../components/Field.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { DEFAULTS_DOC_ID, saveSurcharges } from '../../../services/catalog.js'
import { getDocData } from '../../../services/db.js'
import { SIZES } from '../../../utils/constants.js'
import { btnPrimary, cardClass } from '../../../utils/ui.js'

const loadStandard = async () => {
  const [doc, defaults] = await Promise.all([
    getDocData('settings', 'sizeSurcharges'),
    getDocData('productPrivate', DEFAULTS_DOC_ID).catch(() => null),
  ])
  return {
    sizes: doc?.values ?? {},
    personalization: doc?.personalization ?? 0,
    basePrice: doc?.basePrice ?? 0,
    supplierCost: defaults?.cost ?? 0,
  }
}

/**
 * Valores estándar de la tienda: recargos (por talla y por personalización) y los valores que se
 * proponen al crear una camisa (precio base y costo del proveedor). Cada camisa los toma de aquí.
 */
export default function SizeSurchargesPage() {
  const { data, loading, error, reload } = useAsync(loadStandard)
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return <SurchargesForm initial={data} />
}

function SurchargesForm({ initial }) {
  const [sizes, setSizes] = useState(initial.sizes)
  const [personalization, setPersonalization] = useState(initial.personalization)
  const [basePrice, setBasePrice] = useState(initial.basePrice)
  const [supplierCost, setSupplierCost] = useState(initial.supplierCost)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSave(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await saveSurcharges({ sizes, personalization, basePrice, supplierCost })
      setNotice({ type: 'ok', text: 'Valores guardados.' })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Recargos que se suman al precio. Son los valores estándar de toda la tienda: cada camisa los
        toma de aquí y, si hace falta, se cambian solo en esa camisa. Deja vacío lo que no tenga
        recargo.
      </p>
      <section className={`${cardClass} flex flex-col gap-3`}>
        <h3 className="font-semibold">Valores base para camisas nuevas</h3>
        <p className="text-sm text-muted">
          Se proponen al crear una camisa, que puede cambiarlos. No modifican las camisas que ya
          existen. El costo del proveedor es privado: solo lo ven los administradores.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Precio base de la camisa (₡)">
            <NumberInput value={basePrice} onChange={setBasePrice} />
          </Field>
          <Field label="Costo del proveedor (₡)">
            <NumberInput value={supplierCost} onChange={setSupplierCost} />
          </Field>
        </div>
      </section>
      <section className={`${cardClass} flex flex-col gap-3`}>
        <h3 className="font-semibold">Por talla</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SIZES.map((size) => (
            <Field key={size} label={`Talla ${size} (₡)`}>
              <NumberInput
                value={sizes[size] ?? 0}
                onChange={(v) => setSizes({ ...sizes, [size]: v })}
              />
            </Field>
          ))}
        </div>
      </section>
      <section className={`${cardClass} flex flex-col gap-3`}>
        <h3 className="font-semibold">Personalización</h3>
        <Field label="Nombre y número (₡)" className="max-w-xs">
          <NumberInput value={personalization} onChange={setPersonalization} />
        </Field>
      </section>
      <Notice notice={notice} />
      <button type="submit" disabled={busy} className={`${btnPrimary} self-start`}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
