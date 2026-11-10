import {
  MdConfirmationNumber,
  MdCheckroom,
  MdArticle,
  MdBackup,
  MdDashboard,
  MdHistory,
  MdLocalOffer,
  MdReceiptLong,
  MdLocalShipping,
  MdRateReview,
  MdPeople,
  MdQrCodeScanner,
  MdSettings,
  MdTune,
} from 'react-icons/md'

/**
 * Menú de administración agrupado por tarea. Las camisas también se agregan y administran
 * desde Inicio (botones solo para admins); aquí se accede a `/admin/productos` desde Catálogo.
 * «Predeterminados» reúne en pestañas secciones, parches, competiciones, recargos y tallas.
 */
export const ADMIN_GROUPS = [
  {
    title: 'Ventas',
    items: [
      { to: '/admin/resumen', label: 'Resumen', icon: MdDashboard },
      { to: '/admin/pedidos', label: 'Pedidos', icon: MdReceiptLong },
      { to: '/admin/proveedor', label: 'Proveedor', icon: MdLocalShipping },
      { to: '/admin/entrega', label: 'Entrega', icon: MdQrCodeScanner },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/admin/productos', label: 'Camisas', icon: MdCheckroom },
      { to: '/admin/predeterminados', label: 'Predeterminados', icon: MdTune },
      { to: '/admin/ofertas', label: 'Ofertas', icon: MdLocalOffer },
      { to: '/admin/cupones', label: 'Cupones', icon: MdConfirmationNumber },
    ],
  },
  {
    title: 'Tienda',
    items: [
      { to: '/admin/resenas', label: 'Reseñas', icon: MdRateReview },
      { to: '/admin/contenido', label: 'Contenido', icon: MdArticle },
      { to: '/admin/usuarios', label: 'Usuarios', icon: MdPeople },
      { to: '/admin/ajustes', label: 'Ajustes', icon: MdSettings },
      { to: '/admin/bitacora', label: 'Bitácora', icon: MdHistory },
      { to: '/admin/respaldo', label: 'Respaldo', icon: MdBackup },
    ],
  },
]

/** Lista plana de todas las pestañas (para ubicar la pantalla actual). */
export const ADMIN_NAV = ADMIN_GROUPS.flatMap((g) => g.items)
