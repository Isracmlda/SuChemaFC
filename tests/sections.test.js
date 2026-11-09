import { describe, expect, it } from 'vitest'
import {
  buildImportPlan,
  MAX_IMPORT_SECTIONS,
  parseSectionPaste,
} from '../src/features/admin/catalog/sectionImport.js'
import {
  MAX_SECTION_DEPTH,
  buildTree,
  flattenVisible,
  sectionDepth,
  validateNewSection,
} from '../src/utils/tree.js'

const sec = (id, name, parentId = null, order = 0) => ({ id, name, parentId, order, visible: true })

const base = [
  sec('liga', 'Liga Española'),
  sec('barca', 'FC Barcelona', 'liga'),
  sec('visita', 'Visita', 'barca'),
  sec('nino', 'Niño', 'visita'),
  sec('fan', 'Fan versión', 'nino'),
]

describe('niveles de secciones', () => {
  it('calcula el nivel de cada sección', () => {
    expect(sectionDepth(base, null)).toBe(0)
    expect(sectionDepth(base, 'liga')).toBe(1)
    expect(sectionDepth(base, 'fan')).toBe(5)
  })

  it('admite hasta 5 niveles y rechaza el sexto', () => {
    expect(MAX_SECTION_DEPTH).toBe(5)
    expect(validateNewSection(base, 'Local', 'nino')).toBe('')
    expect(validateNewSection(base, 'Extra', 'fan')).toMatch(/5 niveles/)
  })

  it('rechaza nombres vacíos, repetidos en la misma ubicación y padres inexistentes', () => {
    expect(validateNewSection(base, '  ')).toMatch(/nombre/)
    expect(validateNewSection(base, 'fc barcelóna', 'liga')).toMatch(/Ya existe/)
    expect(validateNewSection(base, 'FC Barcelona', null)).toBe('')
    expect(validateNewSection(base, 'X', 'nada')).toMatch(/ya no existe/)
  })

  it('el mantenimiento solo muestra las ramas abiertas', () => {
    const tree = buildTree(base)
    expect(flattenVisible(tree, new Set()).map((s) => s.id)).toEqual(['liga'])
    const open = flattenVisible(tree, new Set(['liga', 'barca']))
    expect(open.map((s) => [s.id, s.depth])).toEqual([
      ['liga', 0],
      ['barca', 1],
      ['visita', 2],
    ])
    expect(open[0].hasChildren).toBe(true)
    expect(open[2].hasChildren).toBe(true)
  })
})

describe('pegado desde Excel', () => {
  it('separa niveles por tabulador y filas por salto de línea', () => {
    const { rows, errors } = parseSectionPaste('Liga\tBarça\tVisita\r\nLiga\tReal\n')
    expect(errors).toEqual([])
    expect(rows.map((r) => r.path)).toEqual([
      ['Liga', 'Barça', 'Visita'],
      ['Liga', 'Real'],
    ])
  })

  it('una sola columna son secciones del mismo nivel', () => {
    const { rows } = parseSectionPaste('Premier League\nSerie A\n\nBundesliga')
    expect(rows.map((r) => r.path)).toEqual([['Premier League'], ['Serie A'], ['Bundesliga']])
  })

  it('acepta ">" como separador y comillas de Excel', () => {
    const { rows } = parseSectionPaste('Liga > "Equipo ""A"""')
    expect(rows[0].path).toEqual(['Liga', 'Equipo "A"'])
  })

  it('una fila que empieza con celdas vacías hereda los niveles de la anterior', () => {
    const { rows, errors } = parseSectionPaste('Liga\tBarça\tLocal\n\t\tVisita\n\tReal')
    expect(errors).toEqual([])
    expect(rows.map((r) => r.path)).toEqual([
      ['Liga', 'Barça', 'Local'],
      ['Liga', 'Barça', 'Visita'],
      ['Liga', 'Real'],
    ])
  })

  it('avisa si falta la sección superior o hay celdas vacías en medio', () => {
    expect(parseSectionPaste('\tBarça').errors[0]).toMatchObject({ line: 1 })
    expect(parseSectionPaste('Liga\t\tVisita').errors[0].message).toMatch(/vacía/)
  })
})

describe('plan de carga masiva', () => {
  it('crea el árbol nuevo en orden y con el padre antes que los hijos', () => {
    const { rows } = parseSectionPaste('Premier\tChelsea\tLocal\nPremier\tArsenal\nSerie A')
    const plan = buildImportPlan([], null, rows)
    expect(plan.errors).toEqual([])
    expect(plan.created.map((n) => n.name)).toEqual([
      'Premier',
      'Chelsea',
      'Local',
      'Arsenal',
      'Serie A',
    ])
    const keys = plan.created.map((n) => n.key)
    for (const n of plan.created) {
      if (n.parentKey) expect(keys.indexOf(n.parentKey)).toBeLessThan(keys.indexOf(n.key))
    }
    expect(plan.created.find((n) => n.name === 'Arsenal').parentKey).toBe(
      plan.created.find((n) => n.name === 'Premier').key,
    )
    expect(plan.created.map((n) => n.order)).toEqual([0, 0, 0, 1, 1])
    expect(plan.preview.map((n) => n.depth)).toEqual([1, 2, 3, 2, 1])
  })

  it('reutiliza lo que ya existe sin duplicarlo (sin importar mayúsculas ni tildes)', () => {
    const { rows } = parseSectionPaste(
      'liga espanola\tFC Barcelona\tLocal\nLiga Española\tReal Madrid',
    )
    const plan = buildImportPlan(base, null, rows)
    expect(plan.created.map((n) => n.name)).toEqual(['Local', 'Real Madrid'])
    expect(plan.reused).toBe(2)
    expect(plan.created[0].parentKey).toBe('e:barca')
    expect(plan.created[1].parentKey).toBe('e:liga')
    expect(plan.created[1].order).toBe(1)
    expect(plan.preview.filter((n) => !n.isNew).map((n) => n.name)).toEqual([
      'Liga Española',
      'FC Barcelona',
    ])
  })

  it('carga dentro de la sección elegida y cuenta sus niveles', () => {
    const { rows } = parseSectionPaste('Local\tFan')
    const plan = buildImportPlan(base, 'barca', rows)
    expect(plan.baseDepth).toBe(2)
    expect(plan.created[0]).toMatchObject({ name: 'Local', parentKey: 'e:barca', isNew: true })
    expect(plan.preview.map((n) => n.depth)).toEqual([3, 4])
  })

  it('omite las filas que pasan de 5 niveles y lo informa', () => {
    const { rows } = parseSectionPaste('A\tB\tC\tD\tE\tF\nA\tB')
    const plan = buildImportPlan([], null, rows)
    expect(plan.errors).toHaveLength(1)
    expect(plan.errors[0].line).toBe(1)
    expect(plan.created.map((n) => n.name)).toEqual(['A', 'B'])
    const deep = buildImportPlan(base, 'nino', parseSectionPaste('Uno\tDos').rows)
    expect(deep.created).toHaveLength(0)
    expect(deep.errors).toHaveLength(1)
  })

  it('limita las secciones nuevas por carga', () => {
    const text = Array.from({ length: MAX_IMPORT_SECTIONS + 20 }, (_, i) => `S${i}`).join('\n')
    const plan = buildImportPlan([], null, parseSectionPaste(text).rows)
    expect(plan.created).toHaveLength(MAX_IMPORT_SECTIONS)
    expect(plan.errors.at(-1).message).toMatch(/Máximo/)
  })

  it('repetir una ruta en el pegado no la duplica', () => {
    const plan = buildImportPlan([], null, parseSectionPaste('A\tB\nA\tB\nA\tC').rows)
    expect(plan.created.map((n) => n.name)).toEqual(['A', 'B', 'C'])
  })
})
