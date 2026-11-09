import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { DialogProvider } from './context/DialogProvider.jsx'
import { ToastProvider } from './context/ToastProvider.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { resolveEntry } from './utils/entry.js'

// Ruta única: la barra de direcciones siempre muestra solo el dominio. La ruta de entrada
// (por ejemplo un enlace directo a /rastreo) se lee una vez y luego se oculta de la URL.
const { pathname, search } = window.location
const entryPath = resolveEntry(pathname, search)
window.history.replaceState(null, '', '/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <MemoryRouter initialEntries={[entryPath]}>
            <ToastProvider>
              <DialogProvider>
                <App />
              </DialogProvider>
            </ToastProvider>
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
