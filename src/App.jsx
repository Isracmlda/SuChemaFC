import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/MainLayout.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'
import { Loading } from './components/States.jsx'
import AdminLayout from './features/admin/AdminLayout.jsx'
import usePageMetaForRoute from './hooks/useRouteMeta.js'
import Catalog from './pages/Catalog.jsx'
import NotFound from './pages/NotFound.jsx'
import Placeholder from './pages/Placeholder.jsx'

// Cada pantalla se descarga solo cuando se visita. El catálogo (portada), el layout y la guardia
// de admin van en el paquete principal porque casi siempre se necesitan.
const lazyPage = (loader) => lazy(loader)

const Product = lazyPage(() => import('./pages/Product.jsx'))
const Tracking = lazyPage(() => import('./pages/Tracking.jsx'))
const Help = lazyPage(() => import('./pages/Help.jsx'))
const Cart = lazyPage(() => import('./pages/Cart.jsx'))
const Checkout = lazyPage(() => import('./pages/Checkout.jsx'))
const Wishlist = lazyPage(() => import('./pages/Wishlist.jsx'))
const MyOrders = lazyPage(() => import('./pages/MyOrders.jsx'))
const Login = lazyPage(() => import('./pages/Login.jsx'))
const DesignTest = lazyPage(() => import('./pages/DesignTest.jsx'))

const OrdersPage = lazyPage(() => import('./features/admin/orders/OrdersPage.jsx'))
const SupplierPage = lazyPage(() => import('./features/admin/supplier/SupplierPage.jsx'))
const DeliveryPage = lazyPage(() => import('./features/admin/delivery/DeliveryPage.jsx'))
const ReviewsPage = lazyPage(() => import('./features/admin/reviews/ReviewsPage.jsx'))
const ContentPage = lazyPage(() => import('./features/admin/content/ContentPage.jsx'))
const DashboardPage = lazyPage(() => import('./features/admin/dashboard/DashboardPage.jsx'))
const AuditPage = lazyPage(() => import('./features/admin/audit/AuditPage.jsx'))
const BackupPage = lazyPage(() => import('./features/admin/dashboard/BackupPage.jsx'))
const ProductsPage = lazyPage(() => import('./features/admin/catalog/ProductsPage.jsx'))
const DefaultsPage = lazyPage(() => import('./features/admin/catalog/DefaultsPage.jsx'))
const SalesPage = lazyPage(() => import('./features/admin/promotions/SalesPage.jsx'))
const CouponsPage = lazyPage(() => import('./features/admin/promotions/CouponsPage.jsx'))
const StoreSettingsPage = lazyPage(() => import('./features/admin/settings/StoreSettingsPage.jsx'))
const UsersPage = lazyPage(() => import('./features/admin/users/UsersPage.jsx'))

export default function App() {
  usePageMetaForRoute()
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Públicas */}
          <Route index element={<Catalog />} />
          <Route path="catalogo" element={<Navigate to="/" replace />} />
          <Route path="producto/:id" element={<Product />} />
          <Route path="rastreo" element={<Tracking />} />
          <Route path="ayuda" element={<Help />} />
          {/* Cliente */}
          <Route path="carrito" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="deseos" element={<Wishlist />} />
          <Route path="mis-pedidos" element={<MyOrders />} />
          <Route path="login" element={<Login />} />
          {/* Admin: exige sesión de Google y admins/{uid} */}
          <Route path="admin" element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="resumen" replace />} />
              <Route path="pedidos" element={<OrdersPage />} />
              <Route path="proveedor" element={<SupplierPage />} />
              <Route path="entrega" element={<DeliveryPage />} />
              <Route path="resenas" element={<ReviewsPage />} />
              <Route path="contenido" element={<ContentPage />} />
              <Route path="resumen" element={<DashboardPage />} />
              <Route path="bitacora" element={<AuditPage />} />
              <Route path="respaldo" element={<BackupPage />} />
              <Route path="productos" element={<ProductsPage />} />
              <Route path="predeterminados/:section?" element={<DefaultsPage />} />
              {/* Rutas anteriores, ahora opciones del submenú Predeterminados */}
              {['secciones', 'parches', 'competiciones', 'recargos', 'tallas'].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<Navigate to={`/admin/predeterminados/${path}`} replace />}
                />
              ))}
              <Route path="hashtags" element={<Navigate to="/admin/productos" replace />} />
              <Route path="ofertas" element={<SalesPage />} />
              <Route path="cupones" element={<CouponsPage />} />
              <Route path="ajustes" element={<StoreSettingsPage />} />
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="*" element={<Placeholder title="Administración" />} />
            </Route>
          </Route>
          {import.meta.env.DEV && <Route path="__design" element={<DesignTest />} />}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
