import { MdHome, MdLocalShipping, MdShoppingCart } from 'react-icons/md'

export const NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true, icon: MdHome },
  { to: '/rastreo', label: 'Rastreo', icon: MdLocalShipping },
  { to: '/carrito', label: 'Carrito', icon: MdShoppingCart },
]
