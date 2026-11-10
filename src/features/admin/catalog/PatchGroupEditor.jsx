import { useState } from 'react'
import { MdAdd, MdClose, MdHideImage } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import Field from '../../../components/Field.jsx'
import ImageUploader from '../../../components/ImageUploader.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { savePatchGroup } from '../../../services/catalog.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'

const EMPTY_GROUP = { name: '', options: [] }

/**
 * Formulario de un grupo de parches (nombre y opciones con imagen opcional y precio).
 * Guarda por sí mismo y avisa con `onSaved({ ...grupo, id })`. Debe ir fuera de otro <form>.
 */
export default function PatchGroupEditor({ initial = EMPTY_GROUP, count = 0, onSaved, onCancel }) {
  const [form, setForm] = useState(initial)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const setOption = (i, patch) =>
    setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }))

  async function handleSave(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const group = {
        ...form,
        name: form.name.trim(),
        options: form.options.filter((o) => o.name.trim()),
      }
      const id = await savePatchGroup(group, count)
      onSaved({ ...group, id, order: group.order ?? count })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <Field label="Nombre del grupo" hint="Ej. Parches de liga, Parches de campeón">
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          maxLength={80}
        />
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-1 font-semibold">Opciones</legend>
        {form.options.map((o, i) => (
          <div key={i} className="@container min-w-0">
            {/* Angosto (celular): dos filas. Ancho (compu): todo en una línea; se decide por el ancho del
              propio recuadro, no de la pantalla, porque el editor vive dentro de un modal. */}
            <div
              className={`${cardClass} flex min-w-0 flex-col gap-2 p-3 @xl:flex-row @xl:items-end`}
            >
              {/* Fila 1: miniatura, nombre y quitar opción. */}
              <div className="flex min-w-0 items-end gap-2 @xl:contents">
                {o.image && (
                  <DriveImage
                    id={o.image}
                    size={160}
                    alt=""
                    className="size-11 shrink-0 rounded-md"
                  />
                )}
                <Field label="Nombre" className="min-w-0 flex-1">
                  <input
                    value={o.name}
                    onChange={(e) => setOption(i, { name: e.target.value })}
                    className={inputClass}
                    maxLength={80}
                  />
                </Field>
                <button
                  type="button"
                  aria-label={`Quitar opción ${o.name || i + 1}`}
                  title="Quitar opción"
                  onClick={() =>
                    setForm({ ...form, options: form.options.filter((_, j) => j !== i) })
                  }
                  className={`${btnIcon} shrink-0 @xl:order-last`}
                >
                  <MdClose className="size-5" aria-hidden="true" />
                </button>
              </div>
              {/* Fila 2: precio y acciones de la imagen; si no caben, bajan a otra línea. */}
              <div className="flex min-w-0 flex-wrap items-end gap-2 @xl:contents">
                <Field label="Precio (₡)" className="w-28 shrink-0">
                  <NumberInput value={o.price} onChange={(price) => setOption(i, { price })} />
                </Field>
                <ImageUploader
                  label={o.image ? 'Cambiar' : 'Imagen'}
                  onUploaded={(id) => setOption(i, { image: id })}
                />
                {o.image && (
                  <button
                    type="button"
                    aria-label="Quitar imagen"
                    title="Quitar imagen"
                    onClick={() => setOption(i, { image: '' })}
                    className={`${btnIcon} shrink-0`}
                  >
                    <MdHideImage className="size-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </fieldset>

      <Notice notice={notice} />
      {/* Los tres botones van juntos en una línea, repartiéndose el ancho (el modal es angosto). */}
      <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:gap-1! [&>*]:px-2! [&>*]:text-xs!">
        <button
          type="button"
          onClick={() =>
            setForm({ ...form, options: [...form.options, { name: '', image: '', price: 0 }] })
          }
          className={btnSecondary}
        >
          <MdAdd className="size-4 shrink-0" aria-hidden="true" />
          Agregar opción
        </button>
        <button type="submit" disabled={busy || !form.name.trim()} className={btnPrimary}>
          {busy ? 'Guardando…' : 'Guardar grupo'}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
