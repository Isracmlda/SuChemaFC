/** SEO y Open Graph: funciones puras que usan la app y el script de prerender (sin dependencias de Vite). */

import { priceSummary } from '../catalog/variants.js'

export const SITE_NAME = 'SuChemaFC'
export const DEFAULT_DESCRIPTION =
  'SuChemaFC: tu equipo, tus colores, tu pasión. Camisetas de fútbol.'
export const PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/

const CRC = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

/** Título de la pestaña: "Catálogo | SuChemaFC", o solo el nombre del sitio. */
export const pageTitle = (title) => (title ? `${title} | ${SITE_NAME}` : SITE_NAME)

/** Títulos de las pantallas fijas. Las de producto ponen el suyo; el admin no se indexa. */
const PAGES = {
  '/': null,
  '/catalogo': 'Catálogo',
  '/carrito': 'Carrito',
  '/checkout': 'Finalizar compra',
  '/deseos': 'Lista de deseos',
  '/rastreo': 'Rastreo de pedido',
  '/mis-pedidos': 'Mis pedidos',
  '/ayuda': 'Ayuda',
  '/login': 'Ingresar',
}

/** { title, description } de una ruta interna, o null si la pantalla pone su propio título. */
export function pageMeta(pathname) {
  if (pathname.startsWith('/producto/')) return null
  if (pathname.startsWith('/admin')) return { title: 'Administración', description: '' }
  const known = pathname in PAGES
  return { title: known ? PAGES[pathname] : 'Página no encontrada', description: '' }
}

/** Recorta un texto a `max` caracteres sin cortar palabras y sin saltos de línea. */
export function shorten(text, max = 160) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length)}…`
}

export const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const trimSlash = (url) => String(url ?? '').replace(/\/+$/, '')

/** Ruta pública y compartible de una camisa (la barra de direcciones se oculta al entrar). */
export const productPath = (id) => `/p/${id}/`
export const productUrl = (siteUrl, id) => `${trimSlash(siteUrl)}${productPath(id)}`

/** URL de una imagen de Drive (misma fórmula que `driveImageUrl` en services/drive.js). */
const driveImage = (fileId, size) =>
  `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${size}`

/**
 * Datos de la vista previa de una camisa: { title, description, image, url }. El precio es el mínimo
 * vigente entre la versión base y las versiones visibles; si varía se escribe "Desde ₡X" para no
 * afirmar un único precio. La imagen es siempre la portada de la camisa base. (No hay JSON-LD.)
 */
export function buildProductMeta(product, siteUrl, now = Date.now()) {
  const { min, from } = priceSummary(product, now)
  const price = Number.isFinite(min) ? `${from ? 'Desde ' : ''}₡${CRC.format(min)}` : ''
  const intro = [price, product.description].filter(Boolean).join(' · ')
  return {
    title: pageTitle(product.name),
    description: shorten(intro || DEFAULT_DESCRIPTION),
    image: product.images?.[0]
      ? driveImage(product.images[0], 1200)
      : `${trimSlash(siteUrl)}/og-default.png`,
    url: productUrl(siteUrl, product.id),
  }
}

/** Vista previa de la portada (con URLs absolutas, que es lo que necesitan los rastreadores). */
export const buildHomeMeta = (siteUrl) => ({
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  image: `${trimSlash(siteUrl)}/og-default.png`,
  url: `${trimSlash(siteUrl)}/`,
  type: 'website',
})

/** Etiquetas del <head> para una vista previa. */
export function headTags(meta) {
  const e = escapeHtml
  return [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.url)}" />`,
    `<meta property="og:type" content="${meta.type ?? 'product'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    `<meta property="og:image" content="${e(meta.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
}

const REPLACED_TAGS = [
  /<title>[\s\S]*?<\/title>/gi,
  /<link\b[^>]*\brel="canonical"[^>]*>/gi,
  /<meta\b[^>]*\b(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>/gi,
]

/** Toma el index.html compilado y reemplaza sus etiquetas de vista previa por las de la camisa. */
export function renderProductHtml(template, meta) {
  let html = template
  for (const pattern of REPLACED_TAGS) html = html.replace(pattern, '')
  return html.replace(/<\/head>/i, `  ${headTags(meta)}\n  </head>`)
}

const isoDay = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null)

/** sitemap.xml con la portada y una URL por camisa. */
export function buildSitemap(siteUrl, products) {
  const base = trimSlash(siteUrl)
  const entry = (loc, lastmod) =>
    `  <url>\n    <loc>${escapeHtml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
  const urls = [
    entry(`${base}/`, null),
    ...products.map((p) => entry(productUrl(base, p.id), isoDay(p.updatedAt ?? p.createdAt))),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export const buildRobots = (siteUrl) =>
  `User-agent: *\nAllow: /\n\nSitemap: ${trimSlash(siteUrl)}/sitemap.xml\n`
