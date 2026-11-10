import { useEffect, useRef, useState } from 'react'
import { MdAddPhotoAlternate } from 'react-icons/md'
import { Notice } from './States.jsx'
import { uploadCatalogImage } from '../services/drive.js'
import { btnSecondary } from '../utils/ui.js'

/**
 * Botón para subir imágenes del catálogo a Drive (vía Apps Script). Llama a `onUploaded(fileId)`
 * por cada imagen subida.
 */
export default function ImageUploader({
  onUploaded,
  label = 'Subir imagen',
  multiple = false,
  maxFiles = Infinity,
  tile = false,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Siempre la versión más reciente: al subir varias seguidas, cada una se suma a la lista actual.
  const latest = useRef(onUploaded)
  useEffect(() => {
    latest.current = onUploaded
  })

  async function handleChange(event) {
    const all = [...event.target.files]
    event.target.value = ''
    if (!all.length) return
    // Solo caben `maxFiles`; las demás se descartan y se avisa.
    const files = all.slice(0, maxFiles)
    setError(
      files.length < all.length ? `Solo se subieron ${files.length} (el máximo se alcanzó).` : '',
    )
    setBusy(true)
    try {
      for (const file of files) {
        const id = await uploadCatalogImage(file)
        latest.current(id)
        // Deja que React aplique este cambio antes de sumar el siguiente.
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        className={
          tile
            ? // Casilla cuadrada punteada que ocupa el lugar de una imagen.
              `flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border-strong p-2 text-center text-sm font-semibold text-muted hover:border-accent hover:text-accent focus-within:border-accent ${busy ? 'opacity-50' : ''}`
            : `${btnSecondary} cursor-pointer ${busy ? 'opacity-50' : ''}`
        }
      >
        <MdAddPhotoAlternate className={tile ? 'size-8' : 'size-5'} aria-hidden="true" />
        {busy ? 'Subiendo…' : label}
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          disabled={busy}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      <Notice notice={error ? { type: 'error', text: error } : null} />
    </div>
  )
}
