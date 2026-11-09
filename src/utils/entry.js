import { PRODUCT_ID } from '../features/seo/seo.js'

/**
 * Ruta interna con la que arranca la app según la URL de entrada (la barra de direcciones se
 * oculta después, así que los enlaces compartibles usan estas formas):
 * - `/?pedido=CODIGO`      → rastreo del pedido
 * - `/?producto=ID` o `/p/ID/` → detalle de la camisa (`/p/ID/` es la página con vista previa)
 */
export function resolveEntry(pathname, search) {
  const params = new URLSearchParams(search)
  if (pathname === '/' && params.has('pedido')) return `/rastreo${search}`
  const productId =
    pathname === '/' ? params.get('producto') : /^\/p\/([^/]+)\/?$/.exec(pathname)?.[1]
  if (productId && PRODUCT_ID.test(productId)) return `/producto/${productId}`
  return pathname + search
}
