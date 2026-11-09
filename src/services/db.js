import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase.js'

const READ_TTL_MS = 60 * 1000
const SETTINGS_TTL_MS = 5 * 60 * 1000
const reads = new Map() // clave -> { at, promise }

/**
 * Guarda en memoria el resultado de una lectura para no repetirla al cambiar de pantalla.
 * Se comparte la promesa, así dos pantallas que piden lo mismo a la vez hacen una sola lectura.
 * Un error nunca se guarda. `clearReadCache` lo vacía (se llama tras cada escritura de admin).
 */
export function cachedRead(key, loader, ttl = READ_TTL_MS) {
  const hit = reads.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.promise
  const promise = loader().catch((error) => {
    if (reads.get(key)?.promise === promise) reads.delete(key)
    throw error
  })
  reads.set(key, { at: Date.now(), promise })
  return promise
}

export const clearReadCache = () => reads.clear()

/** Lee todos los documentos de una colección como [{ id, ...datos }] (caché de 1 minuto). */
export function listCollection(name) {
  return cachedRead(`col:${name}`, async () => {
    const snap = await getDocs(collection(db, name))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }).then((rows) => [...rows])
}

/** Lee un documento sin caché. Devuelve { id, ...datos } o null si no existe. */
export async function getDocData(name, id) {
  const snap = await getDoc(doc(db, name, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Como `getDocData`, pero con caché de 5 minutos: para ajustes que casi nunca cambian. */
export const getDocDataCached = (name, id) =>
  cachedRead(`doc:${name}/${id}`, () => getDocData(name, id), SETTINGS_TTL_MS)

export const docRef = (name, id) => doc(db, name, id)

/** Referencia a un documento nuevo con ID aleatorio. */
export const newDocRef = (name) => doc(collection(db, name))
