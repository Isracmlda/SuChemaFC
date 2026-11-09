import {
  GoogleAuthProvider,
  linkWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { isSuperAdminEmail } from '../utils/constants.js'
import { auth, db } from './firebase.js'

const ERROR_MESSAGES = {
  'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar. Intenta de nuevo.',
  'auth/cancelled-popup-request': 'Ya hay una ventana de inicio de sesión abierta.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana emergente. Permítela e intenta de nuevo.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
}

/** Mensaje en español para un error de inicio de sesión. */
export function authErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] ?? 'No se pudo iniciar sesión. Intenta de nuevo.'
}

/**
 * Inicia sesión con Google. Si hay una sesión anónima (invitado), se vincula a la cuenta de
 * Google para conservar el mismo uid y, con él, los pedidos y comprobantes ya creados.
 * Si esa cuenta de Google ya existe, se inicia sesión en ella (el uid anónimo se abandona).
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const current = auth.currentUser

  if (current?.isAnonymous) {
    try {
      return (await linkWithPopup(current, provider)).user
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(error)
        return (await signInWithCredential(auth, credential)).user
      }
      throw error
    }
  }
  return (await signInWithPopup(auth, provider)).user
}

export function signOutUser() {
  return signOut(auth)
}

/**
 * Devuelve la sesión actual o crea una anónima. Se llama solo cuando hace falta (checkout,
 * subir comprobante) para no crear usuarios anónimos por cada visita.
 */
export async function ensureSession() {
  if (auth.currentUser) return auth.currentUser
  return (await signInAnonymously(auth)).user
}

/**
 * true si la cuenta es admin. El admin fijo (correo verificado) no necesita leer Firestore;
 * para el resto se consulta admins/{uid}, que las reglas solo dejan leer al propio usuario.
 */
export async function fetchIsAdmin(user) {
  if (user.emailVerified && isSuperAdminEmail(user.email)) return true
  const snap = await getDoc(doc(db, 'admins', user.uid))
  return snap.exists()
}

const PROFILE_SYNC_MS = 24 * 60 * 60 * 1000

function profileSyncKey(user) {
  return `suchema:profile:${user.uid}`
}

/**
 * Crea o actualiza users/{uid} con los datos públicos de la cuenta de Google. Para ahorrar
 * escrituras solo se repite si cambiaron los datos o pasaron más de 24 h desde la última vez.
 */
export function upsertUserProfile(user) {
  const signature = `${user.displayName ?? ''}|${user.email ?? ''}|${user.photoURL ?? ''}`
  const storageKey = profileSyncKey(user)
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (saved?.signature === signature && Date.now() - saved.at < PROFILE_SYNC_MS) {
      return Promise.resolve()
    }
  } catch {
    // localStorage no disponible o dañado: se escribe igual.
  }
  return writeUserProfile(user).then(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ signature, at: Date.now() }))
    } catch {
      // Sin almacenamiento: solo se pierde el ahorro.
    }
  })
}

function writeUserProfile(user) {
  return setDoc(
    doc(db, 'users', user.uid),
    {
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}
