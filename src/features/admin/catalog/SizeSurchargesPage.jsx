import { useState } from 'react'
import Field from '../../../components/Field.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { saveSurcharges } from '../../../services/catalog.js'
import { getDocData } from '../../../services/db.js'
import { SIZES } from '../../../utils/constants.js'
import { btnPrimary, cardClass } from '../../../utils/ui.js'

const loadStandard = async () => {
  const doc = await getDocData('settings', 'sizeSurcharges')
  return { sizes: doc?.values ?? {}, personalization: doc?.personalization ?? 0 }
}

/** Recargos estándar (por talla y por personalización). Cada camisa los toma de aquí. */
export default function SizeSurchargesPage() {
  const { data, loading, error, reload } = useAsync(loadStandard)
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return <SurchargesForm initial={data} />
}

function SurchargesForm({ initial }) {
  const [sizes, setSizes] = useState(initial.sizes)
  const [personalization, setPersonalization] = useState(initial.personalization)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSave(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await saveSurcharges({ sizes, personalization })
      setNotice({ type: 'ok', text: 'Recargos guardados.' })
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
        {busy ? 'Guardando…' : 'Guardar recargos'}
      </button>
    </form>
  )
}
