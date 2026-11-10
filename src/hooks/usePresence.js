import { useEffect, useState } from 'react'

/**
 * Permite animar la salida de algo que React quitaría al instante. Devuelve `mounted` (dibujarlo)
 * y `leaving` (está saliendo: aplicar la animación de salida). Tras `ms` deja de dibujarlo.
 * Con "reducir movimiento" activo no espera.
 */
export function usePresence(show, ms = 200) {
  const [mounted, setMounted] = useState(show)
  if (show && !mounted) setMounted(true)

  useEffect(() => {
    if (show || !mounted) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setMounted(false), reduce ? 0 : ms)
    return () => clearTimeout(timer)
  }, [show, mounted, ms])

  return { mounted: show || mounted, leaving: !show }
}
