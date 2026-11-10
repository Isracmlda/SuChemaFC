import { MdCategory, MdEmojiEvents, MdPaid, MdStraighten, MdWorkspacePremium } from 'react-icons/md'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import SizeChartsPage from '../sizeCharts/SizeChartsPage.jsx'
import CompetitionsPage from './CompetitionsPage.jsx'
import PatchGroupsPage from './PatchGroupsPage.jsx'
import SectionsPage from './SectionsPage.jsx'
import SizeSurchargesPage from './SizeSurchargesPage.jsx'

const TABS = [
  { id: 'secciones', label: 'Secciones', icon: MdCategory, Content: SectionsPage },
  { id: 'parches', label: 'Parches', icon: MdWorkspacePremium, Content: PatchGroupsPage },
  { id: 'competiciones', label: 'Competiciones', icon: MdEmojiEvents, Content: CompetitionsPage },
  { id: 'recargos', label: 'Recargos', icon: MdPaid, Content: SizeSurchargesPage },
  { id: 'tallas', label: 'Tallas', icon: MdStraighten, Content: SizeChartsPage },
]

const tabClass = ({ isActive }) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
    isActive
      ? 'border-accent text-accent'
      : 'border-transparent text-muted hover:border-border-strong hover:text-fg'
  }`

/**
 * Predeterminados: lo que se configura una vez para toda la tienda. Barra de pestañas arriba
 * (Secciones, Parches, Competiciones, Recargos y Tallas) y debajo la pantalla de la pestaña
 * elegida. Entra en Secciones. Cada pestaña tiene su propia dirección.
 */
export default function DefaultsPage() {
  const { section } = useParams()
  const tab = TABS.find((t) => t.id === section)
  if (!tab) return <Navigate to="/admin/predeterminados/secciones" replace />
  const { Content } = tab
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Predeterminados"
        className="-mx-1 flex overflow-x-auto border-b border-border px-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <NavLink key={id} to={`/admin/predeterminados/${id}`} replace className={tabClass}>
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Content key={tab.id} />
    </div>
  )
}
