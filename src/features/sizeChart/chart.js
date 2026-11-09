const CM_PER_INCH = 2.54

export const cmToIn = (cm) => cm / CM_PER_INCH

/** Tipos de columna: 'length' se convierte entre cm y pulgadas; 'plain' (kg, edad, códigos) no. */
export const MEASURE_KINDS = { length: 'Medida (cm / pulgadas)', plain: 'Texto (kg, edad, código)' }

/** Tipos de las columnas de una guía; las guías antiguas (sin `kinds`) son todas medidas. */
export const kindsOf = (chart) =>
  Array.isArray(chart.kinds) && chart.kinds.length === chart.measures.length
    ? chart.kinds
    : chart.measures.map(() => 'length')

const round1 = (n) => String(Math.round(n * 10) / 10)

/**
 * Texto de una celda (guardada en cm) en la unidad pedida. Acepta números y rangos como
 * "48-50" o "160/170" (convierte cada número). Vacío si falta el dato.
 */
export function formatMeasure(value, unit, kind = 'length') {
  if (value == null || value === '') return '—'
  if (kind === 'plain') return String(value)
  if (typeof value === 'string') {
    return value.replace(/\d+(?:\.\d+)?/g, (n) =>
      round1(unit === 'in' ? cmToIn(Number(n)) : Number(n)),
    )
  }
  if (!Number.isFinite(Number(value))) return '—'
  return round1(unit === 'in' ? cmToIn(Number(value)) : Number(value))
}

export const emptyChart = () => ({
  name: '',
  note: '',
  measures: ['Largo', 'Ancho'],
  kinds: ['length', 'length'],
  rows: [{ size: '', values: [null, null] }],
})

export function addMeasure(chart, name = '', kind = 'length') {
  return {
    ...chart,
    measures: [...chart.measures, name],
    kinds: [...kindsOf(chart), kind],
    rows: chart.rows.map((r) => ({ ...r, values: [...r.values, null] })),
  }
}

export function removeMeasure(chart, index) {
  return {
    ...chart,
    measures: chart.measures.filter((_, i) => i !== index),
    kinds: kindsOf(chart).filter((_, i) => i !== index),
    rows: chart.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== index) })),
  }
}

export function addRow(chart) {
  return { ...chart, rows: [...chart.rows, { size: '', values: chart.measures.map(() => null) }] }
}

/** Devuelve un texto con el primer problema, o '' si la tabla es válida. */
export function validateChart(chart) {
  if (!chart.name.trim()) return 'Escribe el nombre de la categoría.'
  if (chart.measures.length === 0) return 'Agrega al menos una medida.'
  if (chart.measures.some((m) => !m.trim())) return 'Todas las medidas necesitan nombre.'
  if (chart.rows.length === 0) return 'Agrega al menos una talla.'
  if (chart.rows.some((r) => !r.size.trim())) return 'Todas las filas necesitan nombre de talla.'
  const sizes = chart.rows.map((r) => r.size.trim().toLowerCase())
  if (new Set(sizes).size !== sizes.length) return 'Hay tallas repetidas.'
  return ''
}

// ---------- Guías iniciales: tablas de Kitmm (kitmm1.com/Size-Chart-n2009886.html) ----------

const L = 'length'
const P = 'plain'
const NOTE = 'Las medidas se toman a mano: puede haber una diferencia de 2 a 3 cm.'

const guide = (name, measures, kinds, rows, note = NOTE) => ({
  name,
  note,
  measures,
  kinds,
  rows: rows.map(([size, ...values]) => ({ size, values })),
})

/** Tablas que el proveedor presenta con las tallas en columnas: las pasa a una fila por talla. */
const byColumns = (sizes, lines) => sizes.map((size, i) => [size, ...lines.map((line) => line[i])])

const inchRange = (a, b) => `${round1(a * CM_PER_INCH)}-${round1(b * CM_PER_INCH)}`

const SIZES_5 = ['S', 'M', 'L', 'XL', 'XXL']
const SIZES_NBA = ['S', 'M', 'L', 'XL', 'XXL']

/** Guías de tallas del proveedor, traducidas al español (medidas en cm). */
export const SEED_CHARTS = [
  guide(
    'Camiseta hombre · Versión aficionado',
    ['Ancho', 'Largo', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, P],
    [
      ['S', '48-50', '69-71', '162-170', '50-62'],
      ['M', '50-52', '71-73', '170-176', '62-78'],
      ['L', '52-54', '73-75', '176-182', '78-83'],
      ['XL', '54-56', '75-77', '182-190', '83-90'],
      ['XXL', '56-58', '77-79', '190-195', '90-97'],
      ['3XL', '58-61', '79-81', '192-197', '97-104'],
      ['4XL', '61-64', '81-84', '197-200', '104-110'],
    ],
  ),
  guide(
    'Camiseta hombre · Versión jugador',
    ['Ancho', 'Largo', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, P],
    [
      ['S', '43-45', '68-70', '160-165', '50-62'],
      ['M', '45-47', '70-72', '165-170', '62-75'],
      ['L', '47-49', '72-74', '170-175', '75-80'],
      ['XL', '49-51', '74-76', '175-180', '80-85'],
      ['XXL', '51-53', '76-78', '180-185', '85-90'],
      ['3XL', '53-56', '78-80', '185-190', '90-95'],
    ],
  ),
  guide(
    'Camiseta mujer',
    ['Largo', 'Medio pecho (1/2)', 'Cintura', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, L, P],
    byColumns(SIZES_5, [
      [63, 66, 69, 71, 73],
      [42, 44, 46, 49, 52],
      [39, 41, 43, 45, 48],
      ['155/165', '165/170', '170/175', '175/180', '180/185'],
      ['40-52', '52-58', '58-65', '65-70', '70-75'],
    ]),
  ),
  guide(
    'Camiseta y short niño',
    ['Edad (años)', 'Estatura', 'Largo de camiseta', 'Medio pecho (1/2)', 'Largo de short'],
    [P, L, L, L, L],
    [
      ['16', '3-4', '95/105', 44, 33, 32],
      ['18', '4-5', '105/110', 47, 35, 34],
      ['20', '5-6', '115/125', 50, 36.5, 36],
      ['22', '7-8', '125/135', 53, 38, 38],
      ['24', '8-9', '135/145', 56, 42.5, 39],
      ['26', '10/11', '145/155', 59, 44, 40],
      ['28', '12/14', '155/160', 62, 45.5, 43],
    ],
  ),
  guide(
    'Camiseta manga larga',
    ['Ancho', 'Largo', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, P],
    [
      ['S', inchRange(19.3, 20.0), inchRange(27.9, 28.7), '160-165', '60-65'],
      ['M', inchRange(20.0, 20.8), inchRange(28.7, 29.5), '165-170', '66-70'],
      ['L', inchRange(21.2, 22.0), inchRange(29.5, 30.3), '170-175', '71-75'],
      ['XL', inchRange(22.0, 22.8), inchRange(30.3, 31.1), '175-180', '76-80'],
      ['2XL', inchRange(22.8, 23.6), inchRange(31.1, 31.8), '180-185', '81-87'],
      ['3XL', inchRange(23.6, 24.4), inchRange(32.2, 33.1), '185-190', '88-95'],
    ],
    `El proveedor da el ancho y el largo en pulgadas; aquí están pasados a centímetros. ${NOTE}`,
  ),
  guide(
    'Short hombre',
    ['Largo', 'Cintura (ancho/2)', 'Cadera', 'Muslo', 'Contorno de la basta', 'Estatura'],
    [L, L, L, L, L, L],
    byColumns(SIZES_5, [
      [44, 46, 48, 50, 52],
      [62, 66, 70, 74, 78],
      [104, 104, 108, 112, 126],
      [64, 64, 68, 112, 126],
      [30, 31, 32, 33, 34],
      ['150/159', '160/169', '170/179', '180/189', '190/199'],
    ]),
  ),
  guide(
    'NBA hombre',
    ['Largo', 'Pecho', 'Hombro', 'Estatura', 'Peso (kg)'],
    [L, L, L, L, P],
    byColumns(SIZES_NBA, [
      [70, 72, 75, 77, 80],
      [98, 106, 112, 120, 130],
      [35, 37, 39, 41, 44],
      ['160/170', '168/175', '172/180', '178/185', '183/200'],
      ['45-57', '57-67', '67-82', '82-92', '90-105'],
    ]),
    '',
  ),
  guide(
    'NBA niño',
    ['Largo', 'Ancho', 'Peso (kg)', 'Estatura', 'Edad (años)'],
    [L, L, P, L, P],
    byColumns(
      ['S', 'M', 'L', 'XL'],
      [
        [53, 58, 63, 68],
        [37, 42, 47, 52],
        ['23-30', '35-40', '40-45', '50-55'],
        ['120/130', '130/140', '140/150', '150/160'],
        ['6-8', '8-10', '10-12', '12-14'],
      ],
    ),
    '',
  ),
  guide(
    'Pantalón NBA hombre',
    ['Largo', 'Cintura', 'Estatura', 'Peso (kg)'],
    [L, L, L, P],
    byColumns(SIZES_NBA, [
      [50, 52, 54, 56, 58],
      ['64-90', '68-94', '72-98', '76-102', '80-106'],
      ['165/175', '170/180', '175/185', '180/190', '185/196'],
      ['50-65', '65-75', '75-85', '85-95', '95-110'],
    ]),
    'Ejemplos del proveedor: una persona de 170 cm y 60 kg usa talla S; una de 183 cm y 80 kg usa talla L.',
  ),
  guide(
    'Sudadera con capucha NBA hombre',
    ['Largo', 'Hombro', 'Pecho', 'Largo de manga', 'Código de talla (estatura/pecho)'],
    [L, L, L, L, P],
    byColumns(SIZES_NBA, [
      [68, 70, 72, 74, 76],
      [45, 46, 47, 48, 49],
      [106, 110, 114, 118, 122],
      [53.5, 65, 66.5, 68, 69.5],
      ['165/88A', '170/92A', '175/96A', '180/100', '185/104A'],
    ]),
    '',
  ),
  guide(
    'Rompevientos hombre',
    ['Largo', 'Pecho', 'Largo de manga', 'Hombro', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, L, L, P],
    [
      ['S', 67, 108, 77, 48, '160/170', '50-60'],
      ['M', 69, 112, 79, 50, '170/175', '60-70'],
      ['L', 71, 116, 81, 52, '175/180', '70-75'],
      ['XL', 73, 120, 83, 54, '180/185', '75-80'],
      ['2XL', 75, 124, 85, 56, '185/190', '85-90'],
      ['3XL', 77, 128, 87, 58, '190/195', '90-95'],
    ],
  ),
  guide(
    'Polo y conjunto polo',
    ['Largo', 'Medio pecho (1/2)', 'Estatura'],
    [L, L, L],
    [
      ['S', 70, 49, '168-172'],
      ['M', 72, 51, '172-178'],
      ['L', 74, 53, '175-178'],
      ['XL', 78, 55, '178-185'],
      ['XXL', 80, 57, '185-192'],
    ],
  ),
  guide(
    'Chaqueta y conjunto de entrenamiento hombre',
    ['Largo', 'Medio pecho (1/2)', 'Largo del pantalón', 'Estatura', 'Peso (kg)'],
    [L, L, L, L, P],
    [
      ['S', '68-71', '50-53', '96-98', '160/170', '50-67'],
      ['M', '71-74', '53-55', '98-101', '171/176', '62-75'],
      ['L', '73-76', '55-58', '101-104', '176/182', '70-80'],
      ['XL', '75-78', '57-60', '104-107', '182/190', '81-90'],
      ['XXL', '77-80', '59-60', '107-110', '195/210', '95-115'],
    ],
  ),
  guide(
    'Conjunto de entrenamiento niño',
    ['Largo', 'Medio pecho (1/2)', 'Largo del pantalón', 'Estatura'],
    [L, L, L, L],
    [
      ['10', 55, 40, 78, '115-125'],
      ['12', 57.5, 42, 80, '125-135'],
      ['14', 60, 44, 83, '135-145'],
      ['16', 62.5, 46, 86, '145-155'],
      ['18', 65, 48, 89, '155-165'],
    ],
  ),
  guide(
    'Conjunto manga corta',
    ['Ancho', 'Largo', 'Estatura recomendada', 'Peso recomendado (kg)'],
    [L, L, L, P],
    [
      ['S', 51, 68, '160-170', '55-66'],
      ['M', 53, 70, '165-175', '60-65'],
      ['L', 55, 72, '175-180', '65-70'],
      ['XL', 57, 74, '180-185', '70-75'],
      ['XXL', 59, 76, '185-190', '75-80'],
    ],
  ),
  guide(
    'Conjunto manga corta niño',
    [
      'Ancho',
      'Largo de la prenda',
      'Cintura del pantalón',
      'Largo del pantalón',
      'Estatura',
      'Peso (kg)',
    ],
    [L, L, L, L, L, P],
    byColumns(
      ['18', '20', '22', '24', '26', '28'],
      [
        [36, 38, 40, 42, 44, 46],
        [52, 54, 56, 58, 60, 62],
        [22, 23, 24, 25, 26, 27],
        [33, 35, 37, 39, 41, 43],
        ['100/110', '110/120', '120/130', '130/140', '140/150', '150/160'],
        ['20-25', '25-30', '30-35', '35-40', '40-45', '45-50'],
      ],
    ),
  ),
]
