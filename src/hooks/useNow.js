import { useEffect, useState } from 'react'

/** Hora actual en ms, actualizada cada `everyMs`. Para cuentas regresivas. */
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
