import { useState } from 'react'
import { MdDelete, MdPerson } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { deleteUser, grantAdmin, listUserRows, revokeAdmin } from '../../../services/adminUsers.js'
import { formatDateTime } from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { btnIcon, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { filterUsers } from './users.js'

/** Panel de usuarios: buscar por nombre o correo, dar o quitar el rol de admin y eliminar. */
export default function UsersPage() {
  const { user: me } = useAuth()
  const { data, loading, error, reload } = useAsync(listUserRows)
  const [filters, setFilters] = useState({ name: '', email: '', role: '' })
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const shown = filterUsers(data, filters)

  async function run(row, task, okText) {
    setBusyId(row.uid)
    setNotice(null)
    try {
      await task(row)
      setNotice({ type: 'ok', text: okText })
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  function toggleAdmin(row) {
    const name = row.email || row.displayName
    if (row.isAdmin) {
      if (!window.confirm(`¿Quitar el rol de administrador a ${name}?`)) return
      run(row, revokeAdmin, 'Rol de administrador retirado.')
    } else {
      if (
        !window.confirm(`¿Dar el rol de administrador a ${name}? Podrá gestionar toda la tienda.`)
      )
        return
      run(row, grantAdmin, 'Rol de administrador otorgado.')
    }
  }

  function remove(row) {
    const name = row.email || row.displayName
    if (
      !window.confirm(
        `¿Eliminar a ${name}? Se borra su cuenta y su perfil, pero sus pedidos se conservan.`,
      )
    )
      return
    run(row, deleteUser, 'Usuario eliminado.')
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <p className="text-sm text-muted">
        Solo aparecen quienes ya iniciaron sesión con Google. El administrador principal no se puede
        quitar ni eliminar.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre">
          <input
            type="search"
            value={filters.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Buscar por nombre"
            className={inputClass}
          />
        </Field>
        <Field label="Correo">
          <input
            type="search"
            value={filters.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="Buscar por correo"
            className={inputClass}
          />
        </Field>
        <Field label="Rol">
          <select
            value={filters.role}
            onChange={(e) => set({ role: e.target.value })}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="admin">Administradores</option>
            <option value="cliente">Clientes</option>
          </select>
        </Field>
      </div>

      <Notice notice={notice} />

      <p className="text-sm text-muted" aria-live="polite">
        {shown.length} de {data.length} usuarios
      </p>

      {shown.length === 0 ? (
        <EmptyState>No hay usuarios con esos filtros.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((row) => {
            const itsMe = row.uid === me?.uid
            const busy = busyId === row.uid
            return (
              <li key={row.uid} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                {row.photoURL ? (
                  <img
                    src={row.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-10 rounded-full"
                  />
                ) : (
                  <MdPerson className="size-10 text-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {row.displayName || 'Sin nombre'}
                    {itsMe && <span className="ml-2 text-sm font-normal text-muted">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-muted">{row.email || 'Sin correo'}</p>
                  <p className="text-xs text-muted">
                    {row.lastLoginAt
                      ? `Último acceso: ${formatDateTime(row.lastLoginAt)}`
                      : 'Sin accesos registrados'}
                  </p>
                </div>
                {row.isAdmin && (
                  <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-bold text-accent">
                    {row.isSuper ? 'Admin principal' : 'Admin'}
                  </span>
                )}
                {!row.isSuper && (
                  <>
                    <button
                      type="button"
                      disabled={busy || (itsMe && row.isAdmin)}
                      title={
                        itsMe && row.isAdmin ? 'No puedes quitarte el rol a ti mismo' : undefined
                      }
                      onClick={() => toggleAdmin(row)}
                      className={btnSecondary}
                    >
                      {row.isAdmin ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar a ${row.email || row.displayName}`}
                      title={itsMe ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                      disabled={busy || itsMe}
                      onClick={() => remove(row)}
                      className={`${btnIcon} text-danger`}
                    >
                      <MdDelete className="size-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
