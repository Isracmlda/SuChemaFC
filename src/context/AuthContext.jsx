import { onIdTokenChanged } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import { auth, isFirebaseConfigured } from '../services/firebase.js'
import { fetchIsAdmin, upsertUserProfile } from '../services/auth.js'
import { AuthContext } from './authContext.js'

const INITIAL = { user: null, isAdmin: false, loading: isFirebaseConfigured, error: null }

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL)

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined

    // Se usa onIdTokenChanged (y no onAuthStateChanged) porque al vincular un invitado anónimo
    // con Google el uid se conserva y solo este listener se entera. Para no repetir lecturas en
    // cada renovación horaria del token, solo se reprocesa si cambia el uid o el tipo de sesión.
    let lastKey = null
    return onIdTokenChanged(auth, async (user) => {
      const key = user ? `${user.uid}:${user.isAnonymous}` : 'none'
      if (key === lastKey) return
      lastKey = key

      if (!user) {
        setState({ user: null, isAdmin: false, loading: false, error: null })
        return
      }
      // Los invitados (anónimos) no tienen perfil ni pueden ser admin.
      if (user.isAnonymous) {
        setState({ user, isAdmin: false, loading: false, error: null })
        return
      }
      try {
        const [isAdmin] = await Promise.all([fetchIsAdmin(user), upsertUserProfile(user)])
        setState({ user, isAdmin, loading: false, error: null })
      } catch (error) {
        // Sesión válida pero sin poder leer el rol: se trata como no admin.
        setState({ user, isAdmin: false, loading: false, error })
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      user: state.user,
      isAdmin: state.isAdmin,
      isGuest: Boolean(state.user?.isAnonymous),
      loading: state.loading,
      configured: isFirebaseConfigured,
      error: state.error,
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
