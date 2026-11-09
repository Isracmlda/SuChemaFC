import { useContext } from 'react'
import { ThemeContext } from '../context/themeContext.js'

export function useTheme() {
  return useContext(ThemeContext)
}
