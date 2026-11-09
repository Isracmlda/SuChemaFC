import { MdDarkMode, MdLightMode } from 'react-icons/md'
import { useTheme } from '../hooks/useTheme.js'
import Tooltip from './Tooltip.jsx'

/** Botón de solo ícono para cambiar de tema. Pensado para el navbar, que siempre es negro. */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Modo claro' : 'Modo oscuro'
  const Icon = isDark ? MdLightMode : MdDarkMode

  return (
    <Tooltip label={label} align="end">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className="inline-flex size-11 items-center justify-center rounded-md border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-black"
      >
        <Icon className="size-6" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
