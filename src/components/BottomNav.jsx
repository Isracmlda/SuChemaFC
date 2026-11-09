import { NavLink } from 'react-router-dom'
import { NAV_LINKS } from '../utils/navLinks.js'
import CartBadge from './CartBadge.jsx'

/** Navegación inferior para móvil, compacta: ícono de Material sobre la etiqueta. Negra y dorada. */
export default function BottomNav() {
  return (
    <nav
      aria-label="Navegación móvil"
      className="on-black fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-2 border-brand-gold bg-brand-black md:hidden"
    >
      {NAV_LINKS.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-12 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-semibold leading-none ${
              isActive ? 'bg-brand-gold text-brand-black' : 'text-brand-white'
            }`
          }
        >
          <span className="relative">
            <Icon className="size-5" aria-hidden="true" />
            {to === '/carrito' && (
              <span className="absolute -right-3 -top-1.5">
                <CartBadge />
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
