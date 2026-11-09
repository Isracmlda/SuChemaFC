import { useContext } from 'react'
import { CartContext } from '../context/cartContext.js'

/** { lines, wishlist, count, syncing, syncError, addToCart, setQty, removeLine, clearCart, ... } */
export function useCart() {
  return useContext(CartContext)
}
