import { useEffect, useState } from 'react'
import { fetchCoupon } from '../services/promotions.js'

/**
 * Carga el cupón del código aplicado. Devuelve { coupon, loading, error }.
 * `coupon` es null si el código está vacío o el cupón ya no existe.
 */
export function useCoupon(code) {
  const [state, setState] = useState({ code: '', coupon: null, error: null })

  useEffect(() => {
    if (!code) return undefined
    let alive = true
    fetchCoupon(code).then(
      (coupon) => alive && setState({ code, coupon, error: null }),
      (error) => alive && setState({ code, coupon: null, error }),
    )
    return () => {
      alive = false
    }
  }, [code])

  if (!code) return { coupon: null, loading: false, error: null }
  if (state.code !== code) return { coupon: null, loading: true, error: null }
  return { coupon: state.coupon, loading: false, error: state.error }
}
