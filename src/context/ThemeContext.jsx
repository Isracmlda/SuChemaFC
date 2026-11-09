import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ThemeContext } from './themeContext.js'

const STORAGE_KEY = 'theme'
const TRANSITION_MS = 400

function readInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme)
  const isFirstRender = useRef(true)

  useEffect(() => {
    const root = document.documentElement
    let timer

    // Al cambiar de tema (no al cargar la página) se anima el cambio de colores.
    if (!isFirstRender.current) {
      root.classList.add('theme-transition')
      timer = setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_MS)
    }
    isFirstRender.current = false

    root.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage no disponible: el tema solo dura la sesión.
    }
    return () => clearTimeout(timer)
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
