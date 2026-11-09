import { useState } from 'react'
import { MdAdd, MdClose } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import Field from '../../../components/Field.jsx'
import ImageUploader from '../../../components/ImageUploader.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { savePatchGroup } from '../../../services/catalog.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'

const EMPTY_GROUP = { name: '', image: '', options: [] }

/**
 * Formulario de un grupo de parches (nombre, imagen del grupo y opciones con imagen y precio).
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
      <div className="flex flex-wrap items-end gap-3">
        <DriveImage id={form.image} size={160} alt="" className="size-16 shrink-0 rounded-md" />
        <Field
          label="Nombre del grupo"
          hint="Ej. Parches de liga, Parches de campeón"
          className="min-w-48 flex-1"
        >
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            maxLength={80}
          />
        </Field>
        <ImageUploader
          label={form.image ? 'Cambiar imagen del grupo' : 'Imagen del grupo'}
          onUploaded={(id) => setForm((f) => ({ ...f, image: id }))}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">Opciones</legend>
        {form.options.map((o, i) => (
          <div key={i} className={`${cardClass} flex flex-wrap items-end gap-3`}>
            <DriveImage id={o.image} size={160} alt="" className="size-16 shrink-0 rounded-md" />
            <Field label="Nombre" className="min-w-40 flex-1">
              <input
                value={o.name}
                onChange={(e) => setOption(i, { name: e.target.value })}
                className={inputClass}
                maxLength={80}
              />
            </Field>
            <Field label="Precio (₡)" className="w-32">
              <NumberInput value={o.price} onChange={(price) => setOption(i, { price })} />
            </Field>
            <ImageUploader
              label={o.image ? 'Cambiar imagen' : 'Imagen'}
              onUploaded={(id) => setOption(i, { image: id })}
            />
            <button
              type="button"
              aria-label={`Quitar opción ${o.name || i + 1}`}
              title="Quitar opción"
              onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
              className={btnIcon}
            >
              <MdClose className="size-5" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setForm({ ...form, options: [...form.options, { name: '', image: '', price: 0 }] })
          }
          className={`${btnSecondary} self-start`}
        >
          <MdAdd className="size-5" aria-hidden="true" />
          Agregar opción
        </button>
      </fieldset>

      <Notice notice={notice} />
      <div className="flex gap-2">
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
