import { createContext } from 'react'

export const AuthContext = createContext({
  user: null,
  isAdmin: false,
  isGuest: false,
  loading: false,
  configured: false,
  error: null,
})
