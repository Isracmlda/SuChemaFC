import { MdArrowBack, MdArrowForward, MdClose } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import ImageUploader from '../../../components/ImageUploader.jsx'
import { btnIcon } from '../../../utils/ui.js'

/**
 * Editor reutilizable de galería de imágenes ordenables con subida múltiple.
 */
export default function ImagesEditor({
  images = [],
  onChange,
  label = 'Imágenes',
  hint = 'La primera es la portada.',
  uploadLabel = 'Subir imágenes',
}) {
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
    <div className="flex flex-col gap-3">
      {label && <span className="text-sm font-semibold">{label}</span>}
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {images.length > 0 && (
        <ul
          aria-label="Carrusel de imágenes"
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        >
          {images.map((id, i) => (
            <li
              key={id}
              className="flex shrink-0 basis-[85%] snap-center flex-col gap-1 sm:basis-1/3 md:basis-[85%]"
            >
              <DriveImage
                id={id}
                size={300}
                alt={`Imagen ${i + 1}`}
                className="aspect-square rounded-md"
              />
              <div className="flex flex-wrap justify-between gap-1">
                <button
                  type="button"
                  aria-label={`Mover imagen ${i + 1} a la izquierda`}
                  disabled={i === 0}
                  onClick={() => moveImage(i, -1)}
                  className={btnIcon}
                >
                  <MdArrowBack className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Quitar imagen ${i + 1}`}
                  onClick={() => removeImage(id)}
                  className={btnIcon}
                >
                  <MdClose className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Mover imagen ${i + 1} a la derecha`}
                  disabled={i === images.length - 1}
                  onClick={() => moveImage(i, 1)}
                  className={btnIcon}
                >
                  <MdArrowForward className="size-5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ImageUploader multiple label={uploadLabel} onUploaded={handleUploaded} />
    </div>
  )
}
