import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { normalizeTracking } from '../features/tracking/tracking.js'
import { getDocData } from './db.js'
import { db } from './firebase.js'

const MY_ORDERS_LIMIT = 100

/** Rastreo público por código (las reglas permiten `get` sin sesión). Devuelve null si no existe. */
export async function fetchTracking(code) {
  const data = await getDocData('orderTracking', code)
  return data ? normalizeTracking(code, data) : null
}

/**
 * Pedidos del usuario. La consulta lleva `where uid ==` porque las reglas la exigen; se ordena en
 * el cliente para no necesitar un índice compuesto.
 */
export async function listMyOrders(uid) {
  const snap = await getDocs(
    query(collection(db, 'orders'), where('uid', '==', uid), limit(MY_ORDERS_LIMIT)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
