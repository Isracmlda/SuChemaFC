/**
 * Prerender manual: genera una página estática por camisa (con su Open Graph para WhatsApp e
 * Instagram, que no ejecutan JavaScript), además de sitemap.xml y robots.txt.
 *
 * Uso (después de `npm run build` y antes de desplegar):  npm run prerender
 * Variables opcionales: SITE_URL (por defecto https://<proyecto>.web.app).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VISIBLE_PRODUCTS_QUERY, decodeQueryResult } from '../src/features/seo/firestoreRest.js'
import {
  PRODUCT_ID,
  buildHomeMeta,
  buildProductMeta,
  buildRobots,
  buildSitemap,
  renderProductHtml,
} from '../src/features/seo/seo.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')

/** Lee KEY=valor de .env (sin dependencias). Las variables del entorno tienen prioridad. */
function readEnv() {
  const env = {}
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // sin .env: se usan las variables del entorno
  }
  return { ...env, ...process.env }
}

const env = readEnv()
const projectId = env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('Falta VITE_FIREBASE_PROJECT_ID (en .env o en el entorno).')
  process.exit(1)
}
const siteUrl = (env.SITE_URL || `https://${projectId}.web.app`).replace(/\/+$/, '')

let template
try {
  template = readFileSync(join(dist, 'index.html'), 'utf8')
} catch {
  console.error('No existe dist/index.html. Ejecuta primero: npm run build')
  process.exit(1)
}

const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(VISIBLE_PRODUCTS_QUERY),
})
if (!res.ok) {
  console.error(`Firestore respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}
// Un ID con caracteres raros nunca se convierte en nombre de carpeta.
const products = decodeQueryResult(await res.json()).filter((p) => PRODUCT_ID.test(p.id))

for (const product of products) {
  const dir = join(dist, 'p', product.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.html'),
    renderProductHtml(template, buildProductMeta(product, siteUrl)),
  )
}
// La portada lleva sus etiquetas con URL absoluta (WhatsApp e Instagram no resuelven rutas relativas).
writeFileSync(join(dist, 'index.html'), renderProductHtml(template, buildHomeMeta(siteUrl)))
writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(siteUrl, products))
writeFileSync(join(dist, 'robots.txt'), buildRobots(siteUrl))

console.log(
  `OK  ${products.length} páginas de camisas + portada + sitemap.xml + robots.txt (${siteUrl})`,
)
