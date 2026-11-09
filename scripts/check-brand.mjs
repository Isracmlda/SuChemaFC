import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Verifica que el navbar sea negro fijo y que no use tokens que cambien con el tema.
const dir = new URL('../src/components/', import.meta.url)
const navbar = readFileSync(new URL('Navbar.jsx', dir), 'utf8')
const problems = []

if (!navbar.includes('bg-brand-black')) problems.push('Navbar.jsx debe usar bg-brand-black')
if (/\bbg-(bg|surface|accent|accent-solid)\b/.test(navbar))
  problems.push('Navbar.jsx no debe usar fondos que cambian con el tema')
if (/\bdark:/.test(navbar)) problems.push('Navbar.jsx no debe tener variantes dark:')

// Colores hexadecimales fuera de la paleta en src/ (excepto index.css y el logo placeholder)
const ALLOWED = new Set(['#000000', '#ffffff', '#d4af37', '#a3a3a3'])
function walk(d) {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
for (const file of walk(new URL('../src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  if (!/\.(jsx?|css)$/.test(file) || file.endsWith('index.css')) continue
  for (const m of readFileSync(file, 'utf8').matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    if (!ALLOWED.has(m[0].toLowerCase())) problems.push(`${file}: color fuera de paleta ${m[0]}`)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('OK  navbar negro fijo y colores dentro de la paleta')
