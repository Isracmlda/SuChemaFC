import { MdTimer } from 'react-icons/md'
import { useNow } from '../../hooks/useNow.js'
import { timeLeftText } from './sale.js'

/** Cuenta regresiva de una oferta vigente. Solo se muestra si la oferta la pidió y aún no termina. */
export default function SaleCountdown({ sale }) {
  const now = useNow()
  if (!sale?.countdown || sale.endsAt == null) return null
  const left = timeLeftText(sale.endsAt, now)
  if (!left) return null
  return (
    <p className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
      <MdTimer className="size-5" aria-hidden="true" />
      La oferta termina en {left}
    </p>
  )
}
