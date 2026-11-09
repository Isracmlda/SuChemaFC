import { createContext } from 'react'

export const CartContext = createContext({
  lines: [],
  wishlist: [],
  couponCode: '',
  setCouponCode: () => {},
  count: 0,
  syncing: false,
  syncError: null,
  addToCart: () => false,
  setQty: () => {},
  removeLine: () => {},
  clearCart: () => {},
  acknowledge: () => {},
  toggleWishlist: () => {},
  inWishlist: () => false,
})
