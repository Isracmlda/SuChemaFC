import { describe, expect, it } from 'vitest'
import { RECENT_TAGS, suggestTags, typedToken } from '../src/features/admin/catalog/tagFilter.js'
import { DEFAULT_CHART_NAME, findDefaultChart } from '../src/features/sizeChart/chart.js'

const tag = (name, createdAt) => ({ id: name.toLowerCase(), name, aliases: [], createdAt })
const many = Array.from({ length: 15 }, (_, i) => tag(`Tag${String(i).padStart(2, '0')}`, i + 1))

describe('suggestTags', () => {
  it('sin texto muestra solo los últimos 10, del más nuevo al más antiguo', () => {
    const list = suggestTags(many)
    expect(list).toHaveLength(RECENT_TAGS)
    expect(list[0].name).toBe('Tag14')
    expect(list.at(-1).name).toBe('Tag05')
  })

  it('los hashtags sin fecha cuentan como los más antiguos y los nuevos sin guardar van primero', () => {
    const list = suggestTags([tag('Viejo'), tag('Medio', 5), tag('Nuevo', 0)], {
      pendingIds: ['nuevo'],
    })
    expect(list.map((t) => t.name)).toEqual(['Nuevo', 'Medio', 'Viejo'])
  })

  it('con texto muestra todos los que coinciden, no solo 10', () => {
    expect(suggestTags(many, { text: 'tag' })).toHaveLength(15)
    expect(suggestTags(many, { text: '#tag01' }).map((t) => t.name)).toEqual(['Tag01'])
  })

  it('usa la última palabra escrita y oculta los ya elegidos', () => {
    expect(typedToken('#Arsenal #Bar')).toBe('Bar')
    expect(typedToken('#Arsenal ')).toBe('')
    const tags = [tag('Barca', 1), tag('Barcelona', 2), tag('Arsenal', 3)]
    const list = suggestTags(tags, { text: '#Arsenal #bar', selectedIds: ['barca'] })
    expect(list.map((t) => t.name)).toEqual(['Barcelona'])
  })
})

describe('findDefaultChart', () => {
  it('encuentra la guía de hombre aficionado por su nombre', () => {
    const charts = [
      { id: 'a', name: 'Camiseta mujer' },
      { id: 'b', name: ` ${DEFAULT_CHART_NAME} ` },
    ]
    expect(findDefaultChart(charts)?.id).toBe('b')
    expect(findDefaultChart([{ id: 'a', name: 'Otra' }])).toBeNull()
    expect(findDefaultChart()).toBeNull()
  })
})
