import { describe, expect, it } from 'vitest'
import { buildUserRows, filterUsers } from '../src/features/admin/users/users.js'

const users = [
  { id: 'u1', displayName: 'Ana Pérez', email: 'ana@example.com', lastLoginAt: 5 },
  { id: 'u2', displayName: 'Bruno', email: 'bruno@correo.cr' },
  { id: 'u3', displayName: 'Chema', email: 'crsuchema@gmail.com' },
]
const admins = [
  { id: 'u2', email: 'bruno@correo.cr' },
  { id: 'u9', email: 'sinperfil@x.com' },
]

describe('buildUserRows', () => {
  const rows = buildUserRows(users, admins)

  it('marca admins y al admin fijo, y lo ordena primero', () => {
    expect(rows[0].uid).toBe('u3')
    expect(rows[0]).toMatchObject({ isSuper: true, isAdmin: true })
    expect(rows.find((r) => r.uid === 'u2').isAdmin).toBe(true)
    expect(rows.find((r) => r.uid === 'u1').isAdmin).toBe(false)
  })

  it('incluye admins que aún no tienen perfil', () => {
    const row = rows.find((r) => r.uid === 'u9')
    expect(row).toMatchObject({ isAdmin: true, hasProfile: false, email: 'sinperfil@x.com' })
  })
})

describe('filterUsers', () => {
  const rows = buildUserRows(users, admins)

  it('filtra por nombre sin importar acentos ni mayúsculas', () => {
    expect(filterUsers(rows, { name: 'PEREZ' }).map((r) => r.uid)).toEqual(['u1'])
  })

  it('filtra por correo', () => {
    expect(filterUsers(rows, { email: 'correo.cr' }).map((r) => r.uid)).toEqual(['u2'])
  })

  it('combina filtros y por rol', () => {
    expect(filterUsers(rows, { role: 'cliente' }).map((r) => r.uid)).toEqual(['u1'])
    expect(filterUsers(rows, { role: 'admin', email: 'gmail' }).map((r) => r.uid)).toEqual(['u3'])
    expect(filterUsers(rows, { name: 'ana', email: 'bruno' })).toEqual([])
  })

  it('sin filtros devuelve todo', () => {
    expect(filterUsers(rows)).toHaveLength(4)
  })
})
