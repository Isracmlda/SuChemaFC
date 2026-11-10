import { SIZES } from '../../../utils/constants.js'
import { chartSizes } from '../../sizeChart/chart.js'

/** Genera un identificador único y estable para una nueva versión. */
export function makeVariantId() {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `v_${time}_${rand}`
}

/**
 * Normaliza una lista de tallas: recorta espacios, elimina vacíos y descarta
 * duplicados sin distinguir mayúsculas/minúsculas, conservando el orden de aparición.
 */
export function normalizeSizes(sizes) {
  if (!Array.isArray(sizes)) return []
  const seen = new Set()
  const result = []
  for (const raw of sizes) {
    const s = String(raw).trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(s)
  }
  return result
}

/** Comprueba si una lista de tallas coincide exactamente con las tallas estándar (S…4XL). */
export function areSizesStandard(sizes) {
  if (!Array.isArray(sizes) || sizes.length !== SIZES.length) return false
  return sizes.every((s, i) => s === SIZES[i])
}

/** Valida una lista de tallas. Devuelve un mensaje de error o null si es válida. */
export function validateSizes(sizes, label = 'Tallas') {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return `${label}: debe incluir al menos una talla visible.`
  }
  const seen = new Set()
  for (const raw of sizes) {
    const s = String(raw).trim()
    if (!s) return `${label}: contiene tallas vacías.`
    if (s.length > 15) return `${label}: la talla «${s}» es demasiado larga (máx. 15 caracteres).`
    const key = s.toLowerCase()
    if (seen.has(key)) {
      return `${label}: contiene la talla duplicada «${s}».`
    }
    seen.add(key)
  }
  return null
}

/**
 * Tallas a guardar cuando hay una guía asignada: solo las que existen en la guía (en su orden). Sin
 * selección propia, o si ya ninguna coincide (la guía cambió), se ofrecen todas las de la guía.
 * Sin guía devuelve las tallas tal cual.
 */
function sizesForChart(sizes, chart) {
  const allowed = chartSizes(chart)
  if (!chart || allowed.length === 0) return sizes
  const kept = Array.isArray(sizes) ? allowed.filter((s) => sizes.includes(s)) : []
  return kept.length > 0 ? kept : allowed
}

/**
 * Ajusta las tallas de la camisa base y de cada versión a la guía que tienen asignada (la propia de
 * la versión, o la de la camisa base si no define una). Así lo guardado coincide siempre con la guía.
 * @param {object} product camisa con `sizeChartId?`, `sizes?` y `variants?`
 * @param {Array} charts guías de tallas disponibles
 */
export function applyChartSizes(product, charts = []) {
  const byId = new Map(charts.map((c) => [c.id, c]))
  const baseChart = byId.get(product.sizeChartId)
  const next = { ...product, sizes: sizesForChart(product.sizes, baseChart) }
  if (Array.isArray(product.variants)) {
    next.variants = product.variants.map((v) => {
      const chart = byId.get(v.sizeChartId ?? product.sizeChartId)
      return chart ? { ...v, sizes: sizesForChart(v.sizes, chart) } : v
    })
  }
  return next
}

/**
 * Valida la guía de tallas elegida para la camisa base. Sin guía es válido; con guía, debe existir
 * (si ya hay guías cargadas) para no dejar la camisa apuntando a una guía borrada.
 */
export function validateChartId(sizeChartId, sizeChartIds = [], label = 'Camisa base') {
  const id = String(sizeChartId ?? '').trim()
  if (id && sizeChartIds.length > 0 && !sizeChartIds.includes(id)) {
    return `${label}: la guía de tallas seleccionada no existe.`
  }
  return null
}

/**
 * Valida la lista de versiones del producto.
 * @param {Array} variants Lista de versiones
 * @param {string[]} sizeChartIds IDs válidos de tablas de tallas
 * @returns {string|null} Mensaje de error o null si todo es válido
 */
export function validateVariants(variants, sizeChartIds = []) {
  if (!Array.isArray(variants) || variants.length === 0) return null

  const names = new Set()
  const validCharts = new Set(sizeChartIds)

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const indexLabel = `Versión ${i + 1}`

    if (!v.name || !String(v.name).trim()) {
      return `${indexLabel}: el nombre es obligatorio.`
    }
    const cleanName = String(v.name).trim()
    const nameKey = cleanName.toLowerCase()
    if (names.has(nameKey)) {
      return `Ya existe una versión llamada «${cleanName}».`
    }
    names.add(nameKey)

    if (v.price != null && v.price !== '') {
      const p = Number(v.price)
      if (!Number.isFinite(p) || p < 0 || !Number.isInteger(p)) {
        return `${cleanName}: el precio debe ser un número entero mayor o igual a 0.`
      }
    }

    if (v.sizes != null) {
      const err = validateSizes(v.sizes, `Versión «${cleanName}»`)
      if (err) return err
    }

    if (v.sizeChartId && String(v.sizeChartId).trim()) {
      const chartId = String(v.sizeChartId).trim()
      if (validCharts.size > 0 && !validCharts.has(chartId)) {
        return `${cleanName}: la tabla de tallas seleccionada no existe.`
      }
    }

    if (v.sizeSurcharges && typeof v.sizeSurcharges === 'object') {
      for (const [size, amount] of Object.entries(v.sizeSurcharges)) {
        if (amount != null && amount !== '') {
          const val = Number(amount)
          if (!Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
            return `${cleanName}: el recargo de la talla ${size} debe ser un entero mayor o igual a 0.`
          }
        }
      }
    }

    if (v.personalization?.surcharge != null && v.personalization.surcharge !== '') {
      const val = Number(v.personalization.surcharge)
      if (!Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
        return `${cleanName}: el recargo de personalización debe ser un entero mayor o igual a 0.`
      }
    }
  }

  return null
}

/**
 * Limpia y prepara un objeto de versión para guardarlo en Firestore.
 * Omite campos vacíos o no configurados (para que hereden de la camisa).
 * Preserva el objeto `sale` si ya existía en la versión.
 */
export function cleanVariantForSave(variant, existingVariant = null) {
  const result = {
    id: String(variant.id || '').trim(),
    name: String(variant.name || '').trim(),
    visible: variant.visible !== false,
  }

  if (variant.price != null && variant.price !== '') {
    const p = Number(variant.price)
    if (Number.isFinite(p) && p >= 0) {
      result.price = p
    }
  }

  if (Array.isArray(variant.images) && variant.images.length > 0) {
    result.images = [...variant.images]
  }

  if (Array.isArray(variant.sizes) && variant.sizes.length > 0) {
    result.sizes = normalizeSizes(variant.sizes)
  }

  if (variant.sizeSurcharges && typeof variant.sizeSurcharges === 'object') {
    const surcharges = {}
    for (const [size, amount] of Object.entries(variant.sizeSurcharges)) {
      if (amount != null && amount !== '') {
        const val = Number(amount)
        if (Number.isFinite(val) && val >= 0) {
          surcharges[size] = val
        }
      }
    }
    if (Object.keys(surcharges).length > 0) {
      result.sizeSurcharges = surcharges
    }
  }

  if (Array.isArray(variant.patchGroupIds) && variant.patchGroupIds.length > 0) {
    result.patchGroupIds = [...variant.patchGroupIds]
  }

  if (variant.personalization && typeof variant.personalization === 'object') {
    const p = { enabled: Boolean(variant.personalization.enabled) }
    if (variant.personalization.surcharge != null && variant.personalization.surcharge !== '') {
      const val = Number(variant.personalization.surcharge)
      if (Number.isFinite(val) && val >= 0) {
        p.surcharge = val
      }
    }
    result.personalization = p
  }

  if (variant.sizeChartId && String(variant.sizeChartId).trim()) {
    result.sizeChartId = String(variant.sizeChartId).trim()
  }

  const existingSale = variant.sale ?? existingVariant?.sale
  if (existingSale && typeof existingSale === 'object') {
    result.sale = existingSale
  }

  return result
}

/**
 * Filtra los costos por versión de modo que solo contenga IDs de versiones
 * válidas con costos numéricos mayores o iguales a 0.
 */
export function cleanVariantCosts(variants, variantCosts = {}) {
  if (!Array.isArray(variants) || !variantCosts || typeof variantCosts !== 'object') {
    return {}
  }
  const validIds = new Set(variants.map((v) => v.id))
  const result = {}
  for (const [id, cost] of Object.entries(variantCosts)) {
    if (!validIds.has(id)) continue
    if (cost != null && cost !== '') {
      const num = Number(cost)
      if (Number.isFinite(num) && num >= 0) {
        result[id] = num
      }
    }
  }
  return result
}
