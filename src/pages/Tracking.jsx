import { useCallback, useState } from 'react'
import { MdBookmarkAdd, MdDelete, MdSearch } from 'react-icons/md'
import { useSearchParams } from 'react-router-dom'
import Field from '../components/Field.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import {
  forgetOrderCode,
  loadSavedOrders,
  saveOrderCode,
} from '../features/tracking/savedOrders.js'
import TrackingTimeline from '../features/tracking/TrackingTimeline.jsx'
import { parseTrackingCode, trackingLabel } from '../features/tracking/tracking.js'
import { useAsync } from '../hooks/useAsync.js'
import { fetchTracking } from '../services/tracking.js'
import { formatDateTime } from '../utils/dates.js'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../utils/ui.js'

function Result({ code, onSaved, saved }) {
  const load = useCallback(() => fetchTracking(code), [code])
  const { data, loading, error, reload } = useAsync(load)

  if (loading) return <Loading label="Buscando tu pedido…" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) {
    return (
      <EmptyState>
        No encontramos un pedido con ese código. Revisa que esté completo e intenta de nuevo.
      </EmptyState>
    )
  }
  const isSaved = saved.some((s) => s.code === code)

  return (
    <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="track-result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="track-result" className="text-lg font-bold">
          Tu pedido
        </h2>
        <StatusBadge status={data.status} />
      </div>
      {data.summary.length > 0 && (
        <ul className="list-disc ps-5 text-sm">
          {data.summary.map((item, i) => (
            <li key={i}>
              {item.qty} × {item.name} (talla {item.size})
            </li>
          ))}
        </ul>
      )}
      <TrackingTimeline tracking={data} />
      {!isSaved && (
        <button
          type="button"
          onClick={() => onSaved(saveOrderCode(code, trackingLabel(data.summary)))}
          className={`${btnSecondary} self-start`}
        >
          <MdBookmarkAdd className="size-5" aria-hidden="true" />
          Guardar en este dispositivo
        </button>
      )}
    </section>
  )
}

/** Rastreo público: cualquiera consulta su pedido con el código, sin cuenta. */
export default function Tracking() {
  const [params] = useSearchParams()
  const fromLink = params.get('pedido') ?? ''
  const [text, setText] = useState(fromLink)
  const [code, setCode] = useState(parseTrackingCode(fromLink))
  const [invalid, setInvalid] = useState(Boolean(fromLink) && !parseTrackingCode(fromLink))
  const [saved, setSaved] = useState(loadSavedOrders)

  function search(event) {
    event.preventDefault()
    const parsed = parseTrackingCode(text)
    setInvalid(!parsed)
    setCode(parsed)
  }

  function open(next) {
    setText(next)
    setInvalid(false)
    setCode(next)
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Rastreo de pedido</h1>
      <form onSubmit={search} className="flex flex-col gap-3">
        <Field label="Código de pedido" hint="Pega el código o el enlace que recibiste.">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck="false"
            aria-invalid={invalid}
            className={`${inputClass} font-mono`}
          />
        </Field>
        {invalid && (
          <p role="alert" className="text-sm text-danger">
            <span aria-hidden="true">⚠ </span>
            Ese código no tiene el formato correcto. Cópialo completo de tu confirmación.
          </p>
        )}
        <button type="submit" className={`${btnPrimary} self-start`}>
          <MdSearch className="size-5" aria-hidden="true" />
          Buscar
        </button>
      </form>

      {code && <Result key={code} code={code} saved={saved} onSaved={setSaved} />}

      {saved.length > 0 && (
        <section aria-labelledby="saved-title" className="flex flex-col gap-2">
          <h2 id="saved-title" className="text-lg font-bold">
            Pedidos en este dispositivo
          </h2>
          <ul className="flex flex-col gap-2">
            {saved.map((s) => (
              <li key={s.code} className={`${cardClass} flex flex-wrap items-center gap-2`}>
                <button
                  type="button"
                  onClick={() => open(s.code)}
                  className="min-h-11 flex-1 text-start hover:text-accent"
                >
                  <span className="block font-semibold">{s.label || 'Pedido guardado'}</span>
                  <span className="block text-sm text-muted">
                    {s.at ? formatDateTime(s.at) : ''} · …{s.code.slice(-6)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Olvidar el pedido ${s.label || s.code.slice(-6)}`}
                  title="Olvidar"
                  onClick={() => setSaved(forgetOrderCode(s.code))}
                  className="inline-flex size-10 items-center justify-center rounded-md border border-border-strong hover:border-danger hover:text-danger"
                >
                  <MdDelete className="size-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
