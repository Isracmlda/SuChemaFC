import { useEffect } from 'react'
import { DEFAULT_DESCRIPTION, pageTitle } from '../features/seo/seo.js'

/**
 * Título y descripción de la pestaña. Al salir de la pantalla vuelve a los valores del sitio.
 * Con `enabled = false` no hace nada (la ruta deja que la pantalla ponga los suyos).
 */
export function usePageMeta(title, description = '', enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const meta = document.querySelector('meta[name="description"]')
    document.title = pageTitle(title)
    meta?.setAttribute('content', description || DEFAULT_DESCRIPTION)
    return () => {
      document.title = pageTitle('')
      meta?.setAttribute('content', DEFAULT_DESCRIPTION)
    }
  }, [title, description, enabled])
}
