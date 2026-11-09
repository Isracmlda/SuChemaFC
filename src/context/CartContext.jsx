import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  acknowledgePrices,
  addLine,
  canAddLine,
  cartCount,
  mergeIds,
  mergeLines,
  removeLine as removeFromLines,
  sanitizeIds,
  sanitizeLines,
  setLineQty,
  toggleId,
} from '../features/cart/cart.js'
import { normalizeCode } from '../features/pricing/coupon.js'
import { useAuth } from '../hooks/useAuth.js'
import { loadUserLists, saveUserLists } from '../services/userData.js'
import { CartContext } from './cartContext.js'

const STORAGE_KEY = 'suchema.cart.v1'
const SAVE_DELAY_MS = 1500
const EMPTY = { owner: null, lines: [], wishlist: [], couponCode: '' }

/** `owner` = uid de Google al que pertenece la copia local (null si la hizo un invitado). */
function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      owner: typeof raw?.owner === 'string' ? raw.owner : null,
      lines: sanitizeLines(raw?.lines),
      wishlist: sanitizeIds(raw?.wishlist),
      couponCode: typeof raw?.couponCode === 'string' ? normalizeCode(raw.couponCode) : '',
    }
  } catch {
    return EMPTY
  }
}

const remoteJson = (cart, wishlist) => JSON.stringify({ cart, wishlist })

/**
 * Carrito y lista de deseos.
 * - Invitados: solo en localStorage.
 * - Con Google: además en users/{uid}, con una escritura agrupada 1,5 s después del último cambio.
 * - Al iniciar sesión, si la copia local la hizo un invitado se fusiona con la remota; si ya era de
 *   esa cuenta, manda la remota (así lo borrado en otro dispositivo no reaparece).
 * - Al cerrar sesión se vacía la copia local para no dejar el carrito en un equipo compartido.
 */
export function CartProvider({ children }) {
  const { user, isGuest, loading } = useAuth()
  const uid = user && !isGuest ? user.uid : null

  const [data, setData] = useState(readLocal)
  const [readyUid, setReadyUid] = useState(null) // uid cuyo remoto ya se cargó y fusionó
  const [syncError, setSyncError] = useState(null)

  const dataRef = useRef(data)
  const lastSaved = useRef('') // JSON de lo último que sabemos que está en Firestore
  const wasSignedIn = useRef(false)

  useEffect(() => {
    dataRef.current = data
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* almacenamiento lleno o bloqueado: el carrito sigue funcionando en memoria */
    }
  }, [data])

  // Inicio y cierre de sesión con Google.
  useEffect(() => {
    if (loading) return undefined
    if (!uid) {
      if (wasSignedIn.current) {
        wasSignedIn.current = false
        setReadyUid(null)
        setData(EMPTY)
      }
      return undefined
    }
    wasSignedIn.current = true

    let cancelled = false
    loadUserLists(uid)
      .then((remote) => {
        if (cancelled) return
        const cart = sanitizeLines(remote.cart)
        const wishlist = sanitizeIds(remote.wishlist)
        lastSaved.current = remoteJson(cart, wishlist)
        const local = dataRef.current
        const fromThisAccount = local.owner === uid
        setData((d) => ({
          ...d,
          owner: uid,
          lines: fromThisAccount ? cart : mergeLines(cart, local.lines),
          wishlist: fromThisAccount ? wishlist : mergeIds(wishlist, local.wishlist),
        }))
        setSyncError(null)
        setReadyUid(uid)
      })
      .catch((error) => {
        if (!cancelled) setSyncError(error)
      })
    return () => {
      cancelled = true
    }
  }, [uid, loading])

  // Escritura agrupada a Firestore (solo con Google y después de la fusión).
  useEffect(() => {
    if (!uid || readyUid !== uid) return undefined
    if (remoteJson(data.lines, data.wishlist) === lastSaved.current) return undefined
    const timer = setTimeout(() => {
      const json = remoteJson(data.lines, data.wishlist)
      saveUserLists(uid, { cart: data.lines, wishlist: data.wishlist })
        .then(() => {
          lastSaved.current = json
          setSyncError(null)
        })
        .catch(setSyncError)
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [data, uid, readyUid])

  /** Devuelve false si el carrito está lleno y la línea sería nueva. */
  const addToCart = useCallback((line) => {
    if (!canAddLine(dataRef.current.lines, line)) return false
    setData((d) => ({ ...d, lines: addLine(d.lines, line) }))
    return true
  }, [])
  const setQty = useCallback(
    (key, qty) => setData((d) => ({ ...d, lines: setLineQty(d.lines, key, qty) })),
    [],
  )
  const removeLine = useCallback(
    (key) => setData((d) => ({ ...d, lines: removeFromLines(d.lines, key) })),
    [],
  )
  const clearCart = useCallback(() => setData((d) => ({ ...d, lines: [], couponCode: '' })), [])
  const setCouponCode = useCallback(
    (code) => setData((d) => ({ ...d, couponCode: normalizeCode(code) })),
    [],
  )
  const acknowledge = useCallback(
    (units) => setData((d) => ({ ...d, lines: acknowledgePrices(d.lines, units) })),
    [],
  )
  const toggleWishlist = useCallback(
    (id) => setData((d) => ({ ...d, wishlist: toggleId(d.wishlist, id) })),
    [],
  )

  const value = useMemo(
    () => ({
      lines: data.lines,
      wishlist: data.wishlist,
      couponCode: data.couponCode,
      setCouponCode,
      count: cartCount(data.lines),
      syncing: Boolean(uid) && readyUid !== uid && !syncError,
      syncError,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      acknowledge,
      toggleWishlist,
      inWishlist: (id) => data.wishlist.includes(id),
    }),
    [
      data,
      uid,
      readyUid,
      syncError,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      acknowledge,
      toggleWishlist,
      setCouponCode,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
