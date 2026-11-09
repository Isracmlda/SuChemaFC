import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import Footer from '../components/Footer.jsx'
import Navbar from '../components/Navbar.jsx'
import WhatsAppButton from '../components/WhatsAppButton.jsx'

export default function MainLayout() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <Navbar />
      {/* La key reinicia la animación de entrada en cada cambio de ruta */}
      <main key={pathname} className="page-enter mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </div>
  )
}
