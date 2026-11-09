import { useState } from 'react'
import { MdAddPhotoAlternate, MdClose, MdStar, MdStarBorder } from 'react-icons/md'
import DriveImage from '../../components/DriveImage.jsx'
import Field from '../../components/Field.jsx'
import { Notice } from '../../components/States.jsx'
import { createReview } from '../../services/reviews.js'
import { uploadReviewPhoto } from '../../services/drive.js'
import { errorMessage } from '../../utils/errors.js'
import { btnPrimary, btnSecondary, inputClass } from '../../utils/ui.js'
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_TEXT, validateReview } from './reviews.js'

/** Formulario de reseña. Llama a `onSaved()` cuando queda enviada (pendiente de moderación). */
export default function ReviewForm({ productId, user, onSaved }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [touched, setTouched] = useState(false)

  const check = validateReview({ rating, text, photos, authorName: user.displayName })

  async function addPhotos(event) {
    const files = [...event.target.files].slice(0, MAX_REVIEW_PHOTOS - photos.length)
    event.target.value = ''
    if (!files.length) return
    setNotice(null)
    setUploading(true)
    try {
      const ids = []
      for (const file of files) ids.push(await uploadReviewPhoto(file))
      setPhotos((p) => [...p, ...ids].slice(0, MAX_REVIEW_PHOTOS))
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setUploading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setTouched(true)
    if (!check.valid) return
    setBusy(true)
    setNotice(null)
    try {
      await createReview({
        productId,
        uid: user.uid,
        authorName: user.displayName,
        rating,
        text,
        photos,
      })
      onSaved()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Tu calificación</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <span className="sr-only">{n === 1 ? '1 estrella' : `${n} estrellas`}</span>
              <span className="block rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {n <= rating ? (
                  <MdStar className="size-9 text-accent" aria-hidden="true" />
                ) : (
                  <MdStarBorder className="size-9 text-muted" aria-hidden="true" />
                )}
              </span>
            </label>
          ))}
        </div>
        {touched && check.errors.rating && (
          <p role="alert" className="text-sm text-danger">
            <span aria-hidden="true">⚠ </span>
            {check.errors.rating}
          </p>
        )}
      </fieldset>

      <Field label="Tu opinión" hint={`${text.length}/${MAX_REVIEW_TEXT}`}>
        <textarea
          value={text}
          maxLength={MAX_REVIEW_TEXT}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </Field>
      {touched && check.errors.text && (
        <p role="alert" className="-mt-2 text-sm text-danger">
          <span aria-hidden="true">⚠ </span>
          {check.errors.text}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Fotos de tu reseña">
            {photos.map((id) => (
              <li key={id} className="relative">
                <DriveImage id={id} size={160} className="size-20 rounded-md" />
                <button
                  type="button"
                  aria-label="Quitar foto"
                  title="Quitar foto"
                  onClick={() => setPhotos((p) => p.filter((x) => x !== id))}
                  className="absolute -end-2 -top-2 inline-flex size-7 items-center justify-center rounded-full border border-border-strong bg-bg text-fg"
                >
                  <MdClose className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_REVIEW_PHOTOS && (
          <label
            className={`${btnSecondary} cursor-pointer self-start ${uploading ? 'opacity-50' : ''}`}
          >
            <MdAddPhotoAlternate className="size-5" aria-hidden="true" />
            {uploading ? 'Subiendo…' : 'Agregar fotos'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={addPhotos}
              className="sr-only"
            />
          </label>
        )}
        <p className="text-sm text-muted">Hasta {MAX_REVIEW_PHOTOS} fotos (opcional).</p>
      </div>

      {touched && check.errors.author && (
        <p role="alert" className="text-sm text-danger">
          <span aria-hidden="true">⚠ </span>
          {check.errors.author}
        </p>
      )}
      <Notice notice={notice} />
      <button type="submit" disabled={busy || uploading} className={`${btnPrimary} self-start`}>
        {busy ? 'Enviando…' : 'Enviar reseña'}
      </button>
      <p className="text-sm text-muted">Tu reseña se publicará cuando el equipo la apruebe.</p>
    </form>
  )
}
