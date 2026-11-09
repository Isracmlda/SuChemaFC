import { useState } from 'react'
import { MdAdd, MdDelete } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import RichText from '../../../components/RichText.jsx'
import { ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { loadContentBundle, saveContent } from '../../../services/content.js'
import { errorMessage } from '../../../utils/errors.js'
import { toInt } from '../../../utils/format.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import {
  MAX_ANSWER,
  MAX_FAQ,
  MAX_QUESTION,
  MAX_TEXT,
  MAX_WA_MESSAGE,
  fillTemplate,
  validateContent,
} from '../../content/content.js'

const TEXT_FIELDS = [
  ['howToBuy', 'Cómo comprar', 8],
  ['shipping', 'Envíos y entrega', 4],
  ['returns', 'Cambios y devoluciones', 6],
  ['terms', 'Términos y condiciones', 6],
]

function ContentForm({ initial, vars, onSaved }) {
  const [c, setC] = useState(initial)
  const [preview, setPreview] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const problem = validateContent(c)
  const set = (patch) => setC((s) => ({ ...s, ...patch }))
  const setFaq = (i, patch) => set({ faq: c.faq.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await saveContent(c)
      setNotice({ type: 'ok', text: 'Contenido guardado.' })
      onSaved()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Escribe texto simple: <code>## Título</code>, listas con <code>- </code> o <code>1. </code>,{' '}
        <code>**negrita**</code> y párrafos separados por una línea en blanco. Los marcadores{' '}
        <code>{'{adelanto}'}</code>, <code>{'{plazo}'}</code> y <code>{'{tarifa}'}</code> se
        reemplazan solos con los ajustes de la tienda.
      </p>

      {TEXT_FIELDS.map(([key, label, rows]) => (
        <section key={key} className={`${cardClass} flex flex-col gap-2`}>
          <Field label={label} hint={`${c[key].length}/${MAX_TEXT}`}>
            <textarea
              rows={rows}
              value={c[key]}
              onChange={(e) => set({ [key]: e.target.value })}
              className={`${inputClass} py-2`}
            />
          </Field>
          <button
            type="button"
            aria-expanded={preview === key}
            onClick={() => setPreview(preview === key ? null : key)}
            className={`${btnSecondary} self-start`}
          >
            {preview === key ? 'Ocultar vista previa' : 'Vista previa'}
          </button>
          {preview === key && (
            <div className="rounded-md border border-border p-3">
              <RichText text={fillTemplate(c[key], vars)} />
            </div>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-3" aria-labelledby="faq-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="faq-title" className="text-lg font-bold">
            Preguntas frecuentes
          </h2>
          <button
            type="button"
            disabled={c.faq.length >= MAX_FAQ}
            onClick={() => set({ faq: [...c.faq, { q: '', a: '' }] })}
            className={btnSecondary}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar pregunta
          </button>
        </div>
        {c.faq.map((f, i) => (
          <div key={i} className={`${cardClass} flex flex-col gap-2`}>
            <Field label={`Pregunta ${i + 1}`}>
              <input
                value={f.q}
                maxLength={MAX_QUESTION}
                onChange={(e) => setFaq(i, { q: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Respuesta">
              <textarea
                rows={3}
                value={f.a}
                maxLength={MAX_ANSWER}
                onChange={(e) => setFaq(i, { a: e.target.value })}
                className={`${inputClass} py-2`}
              />
            </Field>
            <button
              type="button"
              aria-label={`Quitar la pregunta ${i + 1}`}
              title="Quitar"
              onClick={() => set({ faq: c.faq.filter((_, j) => j !== i) })}
              className={`${btnIcon} self-end`}
            >
              <MdDelete className="size-5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </section>

      <section className={`${cardClass} flex flex-col gap-3`}>
        <h2 className="text-lg font-bold">WhatsApp y plazo</h2>
        <Field
          label="Mensaje inicial del botón de WhatsApp"
          hint={`${c.whatsappMessage.length}/${MAX_WA_MESSAGE}. El número se cambia en Ajustes.`}
        >
          <input
            value={c.whatsappMessage}
            maxLength={MAX_WA_MESSAGE}
            onChange={(e) => set({ whatsappMessage: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Plazo de entrega (días)" hint="Reemplaza {plazo} en los textos.">
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            inputMode="numeric"
            value={c.leadDays}
            onChange={(e) => set({ leadDays: toInt(e.target.value) })}
            className={inputClass}
          />
        </Field>
      </section>

      {problem && <p className="text-sm text-muted">{problem}</p>}
      <Notice notice={notice} />
      <button
        type="submit"
        disabled={busy || Boolean(problem)}
        className={`${btnPrimary} self-start`}
      >
        {busy ? 'Guardando…' : 'Guardar contenido'}
      </button>
    </form>
  )
}

/** Editor del contenido de la página Ayuda y del mensaje del botón de WhatsApp. */
export default function ContentPage() {
  const { data, loading, error, reload } = useAsync(loadContentBundle)
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Contenido informativo</h1>
      <ContentForm
        key={JSON.stringify(data.content)}
        initial={data.content}
        vars={data.vars}
        onSaved={reload}
      />
    </section>
  )
}
