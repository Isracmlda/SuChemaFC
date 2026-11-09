import { normalizeText } from '../../../utils/format.js'
import {
  MAX_SECTION_DEPTH,
  SECTION_NAME_MAX,
  nextOrder,
  sectionDepth,
} from '../../../utils/tree.js'

/** Un lote de Firestore admite 500 escrituras; se deja margen para la bitácora. */
export const MAX_IMPORT_SECTIONS = 400

const unquote = (cell) => {
  const text = cell.trim()
  return text.length >= 2 && text.startsWith('"') && text.endsWith('"')
    ? text.slice(1, -1).replace(/""/g, '"').trim()
    : text
}

/**
 * Convierte el texto pegado (desde Excel o una tabla) en rutas de secciones.
 * Cada fila es una ruta: una celda por nivel (separadas por tabulador o por ">").
 * Una sola columna con varias filas agrega secciones del mismo nivel. Si una fila empieza con
 * celdas vacías, hereda esos niveles de la fila anterior (como una tabla combinada de Excel).
 * Devuelve { rows: [{ line, path }], errors: [{ line, message }] }.
 */
export function parseSectionPaste(text) {
  const rows = []
  const errors = []
  let previous = []
  String(text)
    .replace(/\r/g, '')
    .split('\n')
    .forEach((line, index) => {
      if (!line.trim()) return
      const cells = (line.includes('\t') ? line.split('\t') : line.split('>')).map(unquote)
      while (cells.length && cells[cells.length - 1] === '') cells.pop()
      if (cells.length === 0) return
      const lead = cells.findIndex((c) => c !== '')
      if (lead > previous.length) {
        errors.push({ line: index + 1, message: 'Falta la sección superior de esta fila.' })
        return
      }
      const path = [...previous.slice(0, lead), ...cells.slice(lead)]
      if (path.some((c) => c === '')) {
        errors.push({ line: index + 1, message: 'Hay una celda vacía entre dos niveles.' })
        return
      }
      rows.push({ line: index + 1, path })
      previous = path
    })
  return { rows, errors }
}

/**
 * Plan de carga: qué secciones se crean y cuáles ya existían (misma ubicación y mismo nombre,
 * sin importar mayúsculas ni tildes). `parentId` es la sección donde se carga (null = principales).
 * Devuelve { created, preview, errors, reused, baseDepth }:
 * - created: nodos nuevos en orden de creación (siempre después de su padre).
 * - preview: todos los nodos tocados en orden de árbol, con `depth` absoluto e `isNew`.
 */
export function buildImportPlan(sections, parentId, rows) {
  const baseDepth = sectionDepth(sections, parentId)
  const baseKey = parentId ? `e:${parentId}` : ''
  const existing = new Map()
  for (const s of sections) {
    existing.set(`${s.parentId ? `e:${s.parentId}` : ''}|${normalizeText(s.name)}`, s)
  }

  const touched = new Map() // `${parentKey}|${nombre normalizado}` -> nodo
  const kids = new Map([[baseKey, []]]) // parentKey -> nodos hijos en orden de aparición
  const counters = new Map() // parentKey -> siguiente `order`
  const created = []
  const errors = []

  const orderFor = (parentKey) => {
    if (!counters.has(parentKey)) {
      const siblings = parentKey.startsWith('n:')
        ? []
        : sections.filter((s) => (s.parentId ?? null) === (parentKey ? parentKey.slice(2) : null))
      counters.set(parentKey, nextOrder(siblings))
    }
    const value = counters.get(parentKey)
    counters.set(parentKey, value + 1)
    return value
  }

  let full = false
  for (const { line, path } of rows) {
    if (full) break
    if (baseDepth + path.length > MAX_SECTION_DEPTH) {
      errors.push({
        line,
        message: `"${path.join(' › ')}" supera los ${MAX_SECTION_DEPTH} niveles permitidos.`,
      })
      continue
    }
    if (path.some((n) => n.length > SECTION_NAME_MAX)) {
      errors.push({ line, message: `Un nombre supera los ${SECTION_NAME_MAX} caracteres.` })
      continue
    }
    let parentKey = baseKey
    for (let i = 0; i < path.length; i += 1) {
      const lookup = `${parentKey}|${normalizeText(path[i])}`
      let node = touched.get(lookup)
      if (!node) {
        const old = existing.get(lookup)
        if (old) {
          node = { key: `e:${old.id}`, name: old.name, parentKey, isNew: false }
        } else {
          if (created.length >= MAX_IMPORT_SECTIONS) {
            errors.push({
              line,
              message: `Máximo ${MAX_IMPORT_SECTIONS} secciones nuevas por carga; el resto se omitió.`,
            })
            full = true
            break
          }
          node = {
            key: `n:${created.length}`,
            name: path[i],
            parentKey,
            isNew: true,
            order: orderFor(parentKey),
          }
          created.push(node)
        }
        node.depth = baseDepth + i + 1
        touched.set(lookup, node)
        if (!kids.has(parentKey)) kids.set(parentKey, [])
        kids.get(parentKey).push(node)
      }
      parentKey = node.key
    }
  }

  const preview = []
  const walk = (key) => {
    for (const n of kids.get(key) ?? []) {
      preview.push({ key: n.key, name: n.name, depth: n.depth, isNew: n.isNew })
      walk(n.key)
    }
  }
  walk(baseKey)

  return {
    created,
    preview,
    errors,
    baseDepth,
    reused: [...touched.values()].filter((n) => !n.isNew).length,
  }
}
