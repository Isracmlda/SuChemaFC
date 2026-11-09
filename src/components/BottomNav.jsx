import { NavLink } from 'react-router-dom'
import { MdAdminPanelSettings } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth.js'
import { NAV_LINKS } from '../utils/navLinks.js'
import CartBadge from './CartBadge.jsx'

const ADMIN_LINK = { to: '/admin', label: 'Admin', icon: MdAdminPanelSettings }

/**
 * Navegación inferior para móvil, compacta: ícono de Material sobre la etiqueta. Negra y dorada.
 * Las opciones se reparten el ancho completo; los admins tienen además "Admin".
 */
export default function BottomNav() {
  const { showAdminUi } = useAuth()
  const links = showAdminUi ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS

  return (
    <nav
      aria-label="Navegación móvil"
      style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      className="on-black fixed inset-x-0 bottom-0 z-40 grid border-t-2 border-brand-gold bg-brand-black md:hidden"
    >
      {links.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={to === '/admin' ? 'Administración' : undefined}
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
