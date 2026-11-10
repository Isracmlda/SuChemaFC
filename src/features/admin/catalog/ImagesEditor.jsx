import { MdArrowBack, MdArrowForward, MdClose } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import ImageUploader from '../../../components/ImageUploader.jsx'
import { MAX_PRODUCT_IMAGES } from '../../../utils/constants.js'

// Botón redondo sobre la imagen (siempre visible: también se usa con el dedo).
const overlayBtn =
  'inline-flex size-8 items-center justify-center rounded-full bg-brand-black/75 text-brand-white backdrop-blur-sm hover:bg-brand-gold hover:text-brand-black disabled:pointer-events-none disabled:opacity-30'

/**
 * Editor reutilizable de galería de imágenes. Muestra `max` casillas lado a lado: cada imagen
 * ocupa la suya (con «Portada» en la primera, flechas para intercambiar y ✕ para quitar) y la
 * primera casilla libre es el botón de subir.
 */
export default function ImagesEditor({
  images = [],
  onChange,
  label = 'Imágenes',
  hint = 'La primera es la portada.',
  uploadLabel = 'Subir imágenes',
  max = MAX_PRODUCT_IMAGES,
}) {
  const remaining = Math.max(0, max - images.length)
  // Si hay de más (camisa antigua) se muestran todas; si faltan, se completan con casillas libres.
  const emptySlots = Array.from({ length: remaining }, (_, i) => i)

  function moveImage(i, dir) {
    const list = [...images]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    onChange(list)
  }

  function removeImage(id) {
    onChange(images.filter((x) => x !== id))
  }

  function handleUploaded(id) {
    onChange([...images, id])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        {label ? <span className="text-sm font-semibold">{label}</span> : <span />}
        <span className="text-xs text-muted">
          {images.length}/{max}
        </span>
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}

      <ul aria-label="Imágenes" className="grid grid-cols-2 gap-2">
        {images.map((id, i) => (
          <li
            key={id}
            className="relative overflow-hidden rounded-md border border-border bg-surface-2"
          >
            <DriveImage id={id} size={500} alt={`Imagen ${i + 1}`} className="aspect-square" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-brand-black">
                Portada
              </span>
            )}
            <button
              type="button"
              aria-label={`Quitar imagen ${i + 1}`}
              title="Quitar"
              onClick={() => removeImage(id)}
              className={`${overlayBtn} absolute right-1.5 top-1.5`}
            >
              <MdClose className="size-5" aria-hidden="true" />
            </button>
            {images.length > 1 && (
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                <button
                  type="button"
                  aria-label={`Mover imagen ${i + 1} a la izquierda`}
                  disabled={i === 0}
                  onClick={() => moveImage(i, -1)}
                  className={overlayBtn}
                >
                  <MdArrowBack className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Mover imagen ${i + 1} a la derecha`}
                  disabled={i === images.length - 1}
                  onClick={() => moveImage(i, 1)}
                  className={overlayBtn}
                >
                  <MdArrowForward className="size-5" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}

        {emptySlots.map((slot) => (
          <li key={`libre-${slot}`}>
            {slot === 0 ? (
              <ImageUploader
                multiple
                tile
                maxFiles={remaining}
                label={uploadLabel}
                onUploaded={handleUploaded}
              />
            ) : (
              <div
                aria-hidden="true"
                className="aspect-square rounded-md border-2 border-dashed border-border"
              />
            )}
          </li>
        ))}
      </ul>

      {images.length > max && (
        <p className="text-sm text-muted">Tiene más de {max} imágenes: quita las que sobren.</p>
      )}
    </div>
  )
}
