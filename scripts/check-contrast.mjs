// Verifica contraste WCAG AA de los tokens definidos en src/index.css.
// Uso: npm run check:contrast
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`No se encontró el bloque ${selector}`)
  const end = css.indexOf('\n}', start)
  const vars = {}
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const BRAND = { black: '#000000', gold: '#d4af37', white: '#ffffff', muted: '#a3a3a3' }

// [primer plano, fondo, mínimo, descripción]
const themePairs = (t) => [
  [t.fg, t.bg, 4.5, 'texto sobre fondo'],
  [t.fg, t.surface, 4.5, 'texto sobre superficie'],
  [t.fg, t['surface-2'], 4.5, 'texto sobre superficie 2'],
  [t.muted, t.bg, 4.5, 'texto secundario sobre fondo'],
  [t.muted, t.surface, 4.5, 'texto secundario sobre superficie'],
  [t.muted, t['surface-3'], 4.5, 'texto deshabilitado/secundario sobre superficie 3'],
  [t.accent, t.bg, 4.5, 'dorado (texto) sobre fondo'],
  [t.accent, t.surface, 4.5, 'dorado (texto) sobre superficie'],
  [t.accent, t['surface-2'], 4.5, 'dorado (texto) sobre superficie 2'],
  [t['on-accent'], t['accent-solid'], 4.5, 'texto de botón primario'],
  [t['on-accent'], t['accent-solid-hover'], 4.5, 'texto de botón primario (hover)'],
  [t.danger, t.bg, 4.5, 'error sobre fondo'],
  [t.danger, t.surface, 4.5, 'error sobre superficie'],
  [t.success, t.bg, 4.5, 'éxito sobre fondo'],
  [t.success, t.surface, 4.5, 'éxito sobre superficie'],
  [t.ring, t.bg, 3, 'anillo de foco sobre fondo'],
  [t['border-strong'], t.bg, 3, 'borde de componentes sobre fondo'],
]

const brandPairs = [
  [BRAND.gold, BRAND.black, 4.5, 'navbar: dorado sobre negro'],
  [BRAND.white, BRAND.black, 4.5, 'navbar: blanco sobre negro'],
  [BRAND.muted, BRAND.black, 4.5, 'footer: gris sobre negro'],
  [BRAND.black, BRAND.gold, 4.5, 'enlace activo: negro sobre dorado'],
]

const rows = []
const themes = { claro: block(':root'), oscuro: block('.dark') }
for (const [name, tokens] of Object.entries(themes)) {
  for (const p of themePairs(tokens)) rows.push([name, ...p])
}
for (const p of brandPairs) rows.push(['marca', ...p])

let failed = 0
for (const [scope, fg, bg, min, label] of rows) {
  const r = ratio(fg, bg)
  const ok = r >= min
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${scope}] ${label}: ${r.toFixed(2)}:1 (mín ${min})`)
}

// Reglas de marca: oscuro 100% negro y grises sin matiz
const dark = themes.oscuro
if (dark.bg !== '#000000') {
  console.log('FAIL fondo oscuro debe ser #000000')
  failed++
}
for (const k of ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'muted']) {
  const h = dark[k].slice(1)
  if (!(h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6))) {
    console.log(`FAIL token oscuro "${k}" (${dark[k]}) no es gris neutro`)
    failed++
  }
}

if (failed) {
  console.error(`\n${failed} comprobación(es) fallaron`)
  process.exit(1)
}
console.log('\nTodas las comprobaciones de contraste pasaron')
