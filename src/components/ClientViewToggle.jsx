import { useLocation, useNavigate } from 'react-router-dom'
import { MdAdminPanelSettings, MdPersonOutline } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth.js'
import { navIconActiveClass, navIconClass } from '../utils/ui.js'
import { menuRowClass } from './UserMenu.jsx'
import Tooltip from './Tooltip.jsx'

/**
 * Interruptor para que un admin alterne entre la vista de administrador y la de cliente.
 * Con `row` se dibuja como fila con texto (menú del móvil); si no, como botón de ícono (escritorio).
 * No se muestra a quien no es admin.
 */
export default function ClientViewToggle({ row = false, onToggle }) {
  const { isAdmin, clientView, setClientView } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!isAdmin) return null

  const label = clientView ? 'Volver a vista de administrador' : 'Ver como cliente'
  const Icon = clientView ? MdAdminPanelSettings : MdPersonOutline

  function toggle() {
    const next = !clientView
    setClientView(next)
    // Al pasar a vista de cliente se sale del panel de administración.
    if (next && pathname.startsWith('/admin')) navigate('/')
    onToggle?.()
  }

  if (row) {
    return (
      <button type="button" onClick={toggle} aria-pressed={clientView} className={menuRowClass}>
        <Icon className="size-6 shrink-0" aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={clientView}
        aria-label={label}
        className={clientView ? navIconActiveClass : navIconClass}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
