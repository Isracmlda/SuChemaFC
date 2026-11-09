import { useState } from 'react'
import { MdExpandMore, MdMenu } from 'react-icons/md'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ADMIN_GROUPS, ADMIN_NAV } from './adminNav.js'

const STORAGE_KEY = 'suchema-admin-nav'

/** Grupos abiertos o cerrados que el admin eligió: { [título]: boolean }. */
function loadChoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}

function saveChoices(choices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // Sin localStorage: la elección solo dura mientras la página esté abierta.
  }
}

const linkClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
    isActive ? 'bg-accent-solid text-on-accent' : 'text-fg hover:bg-surface-2 hover:text-accent'
  }`

/**
 * Grupos plegables. Un grupo sin elección guardada solo está abierto si contiene la pantalla
 * actual; `onNavigate` cierra el panel en el celular.
 */
function NavGroups({ pathname, choices, onToggle, onNavigate }) {
  return (
    <div className="flex flex-col gap-2">
      {ADMIN_GROUPS.map((group) => {
        const hasCurrent = group.items.some((i) => pathname.startsWith(i.to))
        const open = choices[group.title] ?? hasCurrent
        const listId = `admin-group-${group.title}`
        return (
          <div key={group.title} role="group" aria-label={group.title} className="flex flex-col">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => onToggle(group.title, !open)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-xs font-bold uppercase tracking-wide text-muted hover:bg-surface-2 hover:text-accent"
            >
              <span>
                {group.title}
                <span className="ms-2 font-normal normal-case">({group.items.length})</span>
              </span>
              <MdExpandMore
                className={`size-5 transition-transform ${open ? '' : '-rotate-90'}`}
                aria-hidden="true"
              />
            </button>
            {open && (
              <div id={listId} className="flex flex-col gap-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={onNavigate} className={linkClass}>
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Marco de la administración. En escritorio, menú lateral fijo con los grupos a la vista.
 * En celular, un solo botón con la pantalla actual que despliega el menú (no ocupa la pantalla).
 */
export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState(loadChoices)
  const { pathname } = useLocation()
  const current = ADMIN_NAV.find((i) => pathname.startsWith(i.to))
  const close = () => setOpen(false)
  const toggleGroup = (title, value) =>
    setChoices((prev) => {
      const next = { ...prev, [title]: value }
      saveChoices(next)
      return next
    })
  const nav = { pathname, choices, onToggle: toggleGroup }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Administración</h1>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Celular y tableta: botón que despliega el menú */}
        <div className="lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border-strong px-3 text-sm font-bold"
          >
            <span className="inline-flex items-center gap-2">
              <MdMenu className="size-5" aria-hidden="true" />
              {current ? current.label : 'Menú de administración'}
            </span>
            <MdExpandMore
              className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {open && (
            <nav
              id="admin-menu"
              aria-label="Administración"
              className="mt-2 max-h-[70svh] overflow-y-auto rounded-lg border border-border bg-surface p-3"
            >
              <NavGroups {...nav} onNavigate={close} />
            </nav>
          )}
        </div>

        {/* Escritorio: menú lateral */}
        <nav
          aria-label="Administración"
          className="sticky top-20 hidden w-56 shrink-0 rounded-lg border border-border bg-surface p-3 lg:block"
        >
          <NavGroups {...nav} />
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
