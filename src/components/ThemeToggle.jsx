import { MdDarkMode, MdLightMode } from 'react-icons/md'
import { useTheme } from '../hooks/useTheme.js'
import { navIconClass } from '../utils/ui.js'
import Tooltip from './Tooltip.jsx'

/** Botón de solo ícono para cambiar de tema. Pensado para el navbar, que siempre es negro. */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Modo claro' : 'Modo oscuro'
  const Icon = isDark ? MdLightMode : MdDarkMode

  return (
    <Tooltip label={label} align="end">
      <button type="button" onClick={toggleTheme} aria-label={label} className={navIconClass}>
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
