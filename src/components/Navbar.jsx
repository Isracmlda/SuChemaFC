import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  MdClose,
  MdDarkMode,
  MdFavoriteBorder,
  MdHelpOutline,
  MdLightMode,
  MdMenu,
} from 'react-icons/md'
import { useTheme } from '../hooks/useTheme.js'
import { NAV_LINKS } from '../utils/navLinks.js'
import { navIconActiveClass, navIconClass } from '../utils/ui.js'
import CartBadge from './CartBadge.jsx'
import ClientViewToggle from './ClientViewToggle.jsx'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import Tooltip from './Tooltip.jsx'
import UserMenu, { AccountBadge, menuRowClass } from './UserMenu.jsx'

const linkClass = ({ isActive }) =>
  `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
    isActive ? 'bg-brand-gold text-brand-black' : 'text-brand-white hover:text-brand-gold'
  }`

const iconLinkClass = ({ isActive }) => (isActive ? navIconActiveClass : navIconClass)

const rowLinkClass = ({ isActive }) =>
  `${menuRowClass} ${isActive ? 'bg-brand-gold text-brand-black' : ''}`

/**
 * Menú desplegable del móvil: cuenta, deseos, ayuda y tema, con texto en cada opción.
 * Siempre montado para poder animar la apertura y el cierre; cerrado queda inerte.
 */
function MobileMenu({ open, onClose }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const ThemeIcon = isDark ? MdLightMode : MdDarkMode

  return (
    <>
      {/* Capa transparente: tocar fuera del menú lo cierra. */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-default md:hidden"
        />
      )}
      <div
        id="menu-movil"
        inert={!open}
        // Cualquier enlace del menú lo cierra al navegar.
        onClick={(e) => e.target.closest('a') && onClose()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className={`absolute inset-x-0 top-full z-50 grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none md:hidden ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden bg-brand-black shadow-lg">
          <div
            className={`flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto px-4 py-3 ${
              open ? 'border-b-2 border-brand-gold' : ''
            }`}
          >
            <UserMenu stacked />
            <ClientViewToggle row onToggle={onClose} />
            <hr className="my-1 border-brand-gold/40" />
            <NavLink to="/deseos" className={rowLinkClass}>
              <MdFavoriteBorder className="size-6 shrink-0" aria-hidden="true" />
              Lista de deseos
            </NavLink>
            <NavLink to="/ayuda" className={rowLinkClass}>
              <MdHelpOutline className="size-6 shrink-0" aria-hidden="true" />
              Ayuda
            </NavLink>
            <button type="button" onClick={toggleTheme} className={menuRowClass}>
              <ThemeIcon className="size-6 shrink-0" aria-hidden="true" />
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Navbar siempre negro (#000000) y con borde dorado, en modo claro y oscuro.
 * Usa solo colores de marca fijos, nunca tokens que cambien con el tema.
 * En móvil las acciones no caben en una fila: se agrupan en un menú desplegable.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header
      className="on-black sticky top-0 z-40 border-b-2 border-brand-gold bg-brand-black"
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link
          to="/"
          onClick={close}
          className="relative z-50 flex items-center gap-3"
          aria-label="SuChemaFC, ir al inicio"
        >
          <Logo size="nav" />
          <span className="text-lg font-extrabold italic text-brand-white">
            SuChema<span className="text-brand-gold">FC</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="size-5" aria-hidden="true" />
              {label}
              {to === '/carrito' && <CartBadge />}
            </NavLink>
          ))}
        </nav>

        {/* Escritorio: íconos sin borde y compactos; un divisor separa la cuenta. */}
        <div className="hidden items-center gap-0.5 md:flex">
          <ClientViewToggle />
          <UserMenu />
          <Tooltip label="Lista de deseos">
            <NavLink to="/deseos" aria-label="Lista de deseos" className={iconLinkClass}>
              <MdFavoriteBorder className="size-5" aria-hidden="true" />
            </NavLink>
          </Tooltip>
          <Tooltip label="Ayuda">
            <NavLink to="/ayuda" aria-label="Ayuda" className={iconLinkClass}>
              <MdHelpOutline className="size-5" aria-hidden="true" />
            </NavLink>
          </Tooltip>
          <ThemeToggle />
          <AccountBadge />
        </div>

        {/* Móvil: un solo botón que abre el menú. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="menu-movil"
          className="relative z-50 inline-flex size-11 items-center justify-center rounded-md border border-brand-gold bg-brand-black text-brand-gold hover:bg-brand-gold hover:text-brand-black md:hidden"
        >
          {open ? (
            <MdClose className="size-6" aria-hidden="true" />
          ) : (
            <MdMenu className="size-6" aria-hidden="true" />
          )}
        </button>

        <MobileMenu open={open} onClose={close} />
      </div>
    </header>
  )
}
