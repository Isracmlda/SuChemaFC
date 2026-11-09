import { toMillis } from '../../../utils/dates.js'
import { isSuperAdminEmail } from '../../../utils/constants.js'
import { normalizeText } from '../../../utils/format.js'

/**
 * Une perfiles (users) y roles (admins) en una lista de filas para el panel de usuarios.
 * Un admin sin perfil (nunca ha entrado) también aparece, con los datos del documento admins.
 */
export function buildUserRows(users, admins) {
  const adminIds = new Map(admins.map((a) => [a.id, a]))
  const rows = users.map((u) => ({
    uid: u.id,
    displayName: u.displayName ?? '',
    email: u.email ?? '',
    photoURL: u.photoURL ?? '',
    lastLoginAt: toMillis(u.lastLoginAt),
    hasProfile: true,
    isSuper: isSuperAdminEmail(u.email),
    isAdmin: adminIds.has(u.id) || isSuperAdminEmail(u.email),
  }))
  const known = new Set(users.map((u) => u.id))
  for (const a of admins) {
    if (known.has(a.id)) continue
    rows.push({
      uid: a.id,
      displayName: '',
      email: a.email ?? '',
      photoURL: '',
      lastLoginAt: null,
      hasProfile: false,
      isSuper: isSuperAdminEmail(a.email),
      isAdmin: true,
    })
  }
  return rows.sort((a, b) => {
    if (a.isSuper !== b.isSuper) return a.isSuper ? -1 : 1
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    return (a.displayName || a.email).localeCompare(b.displayName || b.email, 'es')
  })
}

/** Filtra por nombre y por correo (sin importar mayúsculas ni acentos) y, opcionalmente, por rol. */
export function filterUsers(rows, { name = '', email = '', role = '' } = {}) {
  const n = normalizeText(name)
  const e = normalizeText(email)
  return rows.filter((r) => {
    if (role === 'admin' && !r.isAdmin) return false
    if (role === 'cliente' && r.isAdmin) return false
    if (n && !normalizeText(r.displayName).includes(n)) return false
    if (e && !normalizeText(r.email).includes(e)) return false
    return true
  })
}
