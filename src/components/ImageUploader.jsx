import { useState } from 'react'
import { MdAddPhotoAlternate } from 'react-icons/md'
import { Notice } from './States.jsx'
import { uploadCatalogImage } from '../services/drive.js'
import { btnSecondary } from '../utils/ui.js'

/**
 * Botón para subir imágenes del catálogo a Drive (vía Apps Script). Llama a `onUploaded(fileId)`
 * por cada imagen subida.
 */
export default function ImageUploader({ onUploaded, label = 'Subir imagen', multiple = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    setError('')
    setBusy(true)
    try {
      for (const file of files) onUploaded(await uploadCatalogImage(file))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className={`${btnSecondary} cursor-pointer ${busy ? 'opacity-50' : ''}`}>
        <MdAddPhotoAlternate className="size-5" aria-hidden="true" />
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
