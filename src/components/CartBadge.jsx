import { useCart } from '../hooks/useCart.js'

/** Burbuja blanca con la cantidad de unidades en el carrito. Pensada para fondos negros. */
export default function CartBadge() {
  const { count } = useCart()
  if (count === 0) return null
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-white px-1 text-[11px] font-bold leading-5 text-brand-black"
      >
        {count > 99 ? '99+' : count}
      </span>
      <span className="sr-only">, {count} en el carrito</span>
    </>
  )
}
