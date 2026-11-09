import {
  MdCategory,
  MdConfirmationNumber,
  MdArticle,
  MdBackup,
  MdDashboard,
  MdEmojiEvents,
  MdHistory,
  MdLocalOffer,
  MdPaid,
  MdReceiptLong,
  MdLocalShipping,
  MdRateReview,
  MdPeople,
  MdQrCodeScanner,
  MdSettings,
  MdStraighten,
  MdWorkspacePremium,
} from 'react-icons/md'

/**
 * Menú de administración agrupado por tarea. Las camisas ya no están aquí: se agregan y
 * administran desde Inicio (botones solo para admins); su ruta `/admin/productos` sigue activa.
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
      { to: '/admin/secciones', label: 'Secciones', icon: MdCategory },
      { to: '/admin/parches', label: 'Parches', icon: MdWorkspacePremium },
      { to: '/admin/competiciones', label: 'Competiciones', icon: MdEmojiEvents },
      { to: '/admin/recargos', label: 'Recargos', icon: MdPaid },
      { to: '/admin/tallas', label: 'Tallas', icon: MdStraighten },
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
