import { useCallback, useEffect, useState } from 'react'

/**
 * Ejecuta una función asíncrona al montar y expone { data, loading, error, reload }.
 * `loader` debe ser estable (función de módulo o useCallback). Para recargar con otros
 * parámetros, monta el componente con otra `key`.
 */
export function useAsync(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    loader().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (error) => alive && setState({ data: null, loading: false, error }),
    )
    return () => {
      alive = false
    }
  }, [loader, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
