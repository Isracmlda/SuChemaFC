import { useContext } from 'react'
import { AuthContext } from '../context/authContext.js'

/** { user, isAdmin, isGuest, loading, configured, error } */
export function useAuth() {
  return useContext(AuthContext)
}
