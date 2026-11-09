import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase.js'

/** Lee el carrito y la lista de deseos guardados en users/{uid} (listas crudas, sin validar). */
export async function loadUserLists(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  const data = snap.exists() ? snap.data() : {}
  return { cart: data.cart ?? [], wishlist: data.wishlist ?? [] }
}

/** Guarda ambas listas en una sola escritura. users/{uid} ya existe: lo crea el inicio de sesión. */
export function saveUserLists(uid, { cart, wishlist }) {
  return updateDoc(doc(db, 'users', uid), { cart, wishlist })
}
