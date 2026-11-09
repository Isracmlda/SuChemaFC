import { serverTimestamp } from 'firebase/firestore'
import { buildUserRows } from '../features/admin/users/users.js'
import { commitWithAudit } from './audit.js'
import { callScript } from './drive.js'
import { docRef, listCollection } from './db.js'
import { auth } from './firebase.js'

/** Perfiles y roles en filas listas para el panel (dos lecturas, con caché de 1 minuto). */
export async function listUserRows() {
  const [users, admins] = await Promise.all([listCollection('users'), listCollection('admins')])
  return buildUserRows(users, admins)
}

const label = (user) => user.email || user.displayName || user.uid

/** Da el rol de admin a un usuario. */
export function grantAdmin(user) {
  return commitWithAudit(
    [
      {
        type: 'set',
        ref: docRef('admins', user.uid),
        data: {
          email: user.email,
          createdAt: serverTimestamp(),
          grantedBy: auth.currentUser.uid,
        },
      },
    ],
    {
      action: 'crear',
      collection: 'admins',
      docId: user.uid,
      summary: `Rol de admin para ${label(user)}`.slice(0, 200),
    },
  )
}

/** Quita el rol de admin a un usuario. */
export function revokeAdmin(user) {
  return commitWithAudit([{ type: 'delete', ref: docRef('admins', user.uid) }], {
    action: 'eliminar',
    collection: 'admins',
    docId: user.uid,
    summary: `Sin rol de admin: ${label(user)}`.slice(0, 200),
  })
}

/**
 * Elimina al usuario: primero su acceso (Firebase Auth, vía Apps Script) y después su perfil y
 * su rol. Si falla el primer paso no se toca nada. Sus pedidos se conservan.
 */
export async function deleteUser(user) {
  await callScript('deleteUser', { uid: user.uid })
  const ops = [{ type: 'delete', ref: docRef('admins', user.uid) }]
  if (user.hasProfile) ops.push({ type: 'delete', ref: docRef('users', user.uid) })
  await commitWithAudit(ops, {
    action: 'eliminar',
    collection: 'users',
    docId: user.uid,
    summary: `Usuario ${label(user)}`.slice(0, 200),
  })
}
