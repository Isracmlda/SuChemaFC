import { describe, expect, it } from 'vitest'
import {
  decodeDocument,
  decodeQueryResult,
  decodeValue,
} from '../src/features/seo/firestoreRest.js'
import {
  buildProductMeta,
  buildRobots,
  buildSitemap,
  escapeHtml,
  headTags,
  pageMeta,
  pageTitle,
  productUrl,
  renderProductHtml,
  shorten,
} from '../src/features/seo/seo.js'
import { resolveEntry } from '../src/utils/entry.js'

const SITE = 'https://suchemafc.web.app/'
const product = {
  id: 'abc123',
  name: 'Real Madrid "Local" <2025>',
  description: 'Camiseta oficial\ncon parche.',
  price: 25000,
  images: ['FILE1', 'FILE2'],
}

const TEMPLATE = `<!doctype html><html><head>
<meta charset="UTF-8" />
<meta name="description" content="viejo" />
<meta property="og:title" content="SuChemaFC" />
<meta property="og:image" content="/og-default.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="https://x" />
<title>SuChemaFC</title>
</head><body><div id="root"></div></body></html>`

describe('SEO: títulos y textos', () => {
  it('arma el título de la pestaña', () => {
    expect(pageTitle('Catálogo')).toBe('Catálogo | SuChemaFC')
    expect(pageTitle('')).toBe('SuChemaFC')
  })

  it('títulos por ruta; el producto y desconocidas se tratan aparte', () => {
    expect(pageMeta('/catalogo').title).toBe('Catálogo')
    expect(pageMeta('/').title).toBeNull()
    expect(pageMeta('/producto/abc')).toBeNull()
    expect(pageMeta('/admin/pedidos').title).toBe('Administración')
    expect(pageMeta('/nada').title).toBe('Página no encontrada')
  })

  it('recorta sin cortar palabras ni dejar saltos de línea', () => {
    expect(shorten('a\n\n  b   c')).toBe('a b c')
    const long = 'palabra '.repeat(40)
    const out = shorten(long, 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.endsWith('…')).toBe(true)
    expect(out.includes('palabr…')).toBe(false)
  })

  it('escapa HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })
})

describe('SEO: vista previa de una camisa', () => {
  it('arma título, descripción con precio, imagen de Drive y URL', () => {
    const m = buildProductMeta(product, SITE)
    expect(m.title).toBe('Real Madrid "Local" <2025> | SuChemaFC')
    expect(m.description).toContain('25')
    expect(m.description).toContain('Camiseta oficial con parche.')
    expect(m.image).toBe('https://lh3.googleusercontent.com/d/FILE1=w1200')
    expect(m.url).toBe('https://suchemafc.web.app/p/abc123/')
    expect(productUrl(SITE, 'x')).toBe('https://suchemafc.web.app/p/x/')
  })

  it('usa el precio de oferta y la imagen por defecto si no hay fotos', () => {
    const m = buildProductMeta({ ...product, images: [], sale: { price: 20000 } }, SITE)
    expect(m.description.startsWith('₡20')).toBe(true)
    expect(m.image).toBe('https://suchemafc.web.app/og-default.png')
  })

  it('con versiones de distinto precio usa "Desde" y el precio minimo vigente', () => {
    const now = 1_700_000_000_000
    const withVariants = {
      ...product,
      variants: [
        { id: 'n', name: 'Nino', visible: true, price: 18000 },
        { id: 'o', name: 'Oculta', visible: false, price: 1000 },
      ],
    }
    const m = buildProductMeta(withVariants, SITE, now)
    expect(m.description.startsWith('Desde ₡18')).toBe(true)
    expect(m.description).not.toContain('₡1 000')
    expect(m.image).toBe('https://lh3.googleusercontent.com/d/FILE1=w1200')
  })

  it('la oferta de la base no se hereda a las versiones ni dice "Desde" si el precio es igual', () => {
    const now = 1_700_000_000_000
    const p = {
      ...product,
      sale: { price: 20000 },
      variants: [{ id: 'n', name: 'Nino', visible: true }],
    }
    // base 20 000 (oferta), version 25 000 (sin oferta) -> desde 20 000
    expect(buildProductMeta(p, SITE, now).description.startsWith('Desde ₡20')).toBe(true)
    const same = { ...product, variants: [{ id: 'n', name: 'Nino', visible: true }] }
    expect(buildProductMeta(same, SITE, now).description.startsWith('₡25')).toBe(true)
  })

  it('reemplaza las etiquetas de la plantilla y escapa el contenido', () => {
    const html = renderProductHtml(TEMPLATE, buildProductMeta(product, SITE))
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html).not.toContain('viejo')
    expect(html).toContain('og:image" content="https://lh3.googleusercontent.com/d/FILE1=w1200"')
    expect(html).toContain('&lt;2025&gt;')
    expect(html).not.toContain('<2025>')
    expect(html).toContain('<div id="root"></div>')
    expect(headTags(buildProductMeta(product, SITE))).toContain('twitter:card')
  })

  it('sitemap y robots', () => {
    const xml = buildSitemap(SITE, [
      { id: 'a', updatedAt: Date.UTC(2026, 0, 5) },
      { id: 'b&c', updatedAt: null },
    ])
    expect(xml).toContain('<loc>https://suchemafc.web.app/</loc>')
    expect(xml).toContain('<loc>https://suchemafc.web.app/p/a/</loc>')
    expect(xml).toContain('<lastmod>2026-01-05</lastmod>')
    expect(xml).toContain('b&amp;c')
    expect(buildRobots(SITE)).toContain('Sitemap: https://suchemafc.web.app/sitemap.xml')
  })
})

describe('enlaces de entrada', () => {
  it('rastreo, producto y rutas normales', () => {
    expect(resolveEntry('/', '?pedido=ABC')).toBe('/rastreo?pedido=ABC')
    expect(resolveEntry('/p/abc123/', '')).toBe('/producto/abc123')
    expect(resolveEntry('/p/abc123', '')).toBe('/producto/abc123')
    expect(resolveEntry('/', '?producto=xyz')).toBe('/producto/xyz')
    expect(resolveEntry('/catalogo', '?q=1')).toBe('/catalogo?q=1')
    expect(resolveEntry('/', '')).toBe('/')
  })

  it('rechaza IDs con caracteres raros', () => {
    expect(resolveEntry('/', '?producto=../admin')).toBe('/?producto=../admin')
    expect(resolveEntry('/p/a%2Fb/', '')).toBe('/p/a%2Fb/')
  })
})

describe('lectura REST de Firestore', () => {
  it('decodifica los tipos de valor', () => {
    expect(decodeValue({ stringValue: 'a' })).toBe('a')
    expect(decodeValue({ integerValue: '25000' })).toBe(25000)
    expect(decodeValue({ booleanValue: false })).toBe(false)
    expect(decodeValue({ timestampValue: '1970-01-01T00:00:01Z' })).toBe(1000)
    expect(decodeValue({ arrayValue: {} })).toEqual([])
    expect(decodeValue({ arrayValue: { values: [{ stringValue: 'x' }] } })).toEqual(['x'])
    expect(decodeValue({ mapValue: { fields: { p: { integerValue: '1' } } } })).toEqual({ p: 1 })
    expect(decodeValue({ nullValue: null })).toBeNull()
  })

  it('decodifica documentos y respuestas de runQuery (ignora filas sin documento)', () => {
    const doc = {
      name: 'projects/p/databases/(default)/documents/products/abc',
      fields: { name: { stringValue: 'A' }, price: { integerValue: '5' } },
    }
    expect(decodeDocument(doc)).toEqual({ id: 'abc', name: 'A', price: 5 })
    expect(decodeQueryResult([{ document: doc }, { readTime: 'x' }])).toHaveLength(1)
  })
})
