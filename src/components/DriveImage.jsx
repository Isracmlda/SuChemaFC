import { useState } from 'react'
import { DRIVE_IMAGE_ATTEMPTS, driveImageUrl } from '../services/drive.js'

/**
 * Imagen de Drive sobre fondo neutro, para que se vea bien en ambos temas. Si Drive no sirve la
 * imagen por la URL principal, prueba las alternativas antes de mostrar el aviso.
 */
export default function DriveImage({ id, size = 400, alt = '', className = '' }) {
  const [state, setState] = useState({ id, attempt: 0 })
  // Al cambiar de imagen se vuelve a empezar por la URL principal.
  const attempt = state.id === id ? state.attempt : 0
  const failed = attempt >= DRIVE_IMAGE_ATTEMPTS

  return (
    <div className={`flex items-center justify-center overflow-hidden bg-surface-2 ${className}`}>
      {id && !failed ? (
        <img
          src={driveImageUrl(id, size, attempt)}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setState({ id, attempt: attempt + 1 })}
          className="size-full object-cover"
        />
      ) : (
        <span className="px-2 text-center text-xs text-muted">
          {id ? 'No se pudo cargar la imagen' : 'Sin imagen'}
        </span>
      )}
    </div>
  )
}
