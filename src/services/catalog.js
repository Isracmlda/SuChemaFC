import {
  collection,
  deleteField,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import {
  areSizesStandard,
  cleanVariantCosts,
  cleanVariantForSave,
  normalizeSizes,
} from '../features/admin/catalog/productAdmin.js'
import { cleanDisabledPatches, usedPatchGroupIds } from '../features/catalog/patches.js'
import { kindsOf } from '../features/sizeChart/chart.js'
import { SIZES } from '../utils/constants.js'
import { slugify, normalizeText } from '../utils/format.js'
import { nextOrder, validateNewSection } from '../utils/tree.js'
import { commitWithAudit } from './audit.js'
import { db } from './firebase.js'
import { docRef, newDocRef } from './db.js'

const SUMMARY_MAX = 500
const cut = (text) => String(text).slice(0, SUMMARY_MAX)

/**
 * Valor de una celda de la guía de tallas: número si es un número simple (acepta coma decimal),
 * texto si es un rango o una nota ("48-50", "160/170"), o null si está vacía.
 */
function toCell(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (text === '') return null
  return /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : text.slice(0, 30)
}

// ---------- Secciones ----------

/** Crea o actualiza una sección. `order` solo se asigna al crear (al final de sus hermanas). */
export async function saveSection(section, siblingsCount = 0) {
  const isNew = !section.id
  const ref = isNew ? newDocRef('sections') : docRef('sections', section.id)
  const data = {
    name: section.name.trim(),
    slug: slugify(section.name),
    parentId: section.parentId || null,
    order: isNew ? siblingsCount : section.order,
    visible: section.visible ?? true,
  }
  await commitWithAudit([{ type: 'set', ref, data }], {
    action: isNew ? 'crear' : 'editar',
    collection: 'sections',
    docId: ref.id,
    summary: cut(`Sección "${data.name}"`),
  })
  return ref.id
}

/**
 * Crea una sección validando nombre, repetidos y el máximo de niveles.
 * Devuelve la sección ya con su ID, lista para agregarla a la lista local.
 */
export async function createSection({ name, parentId }, sections) {
  const problem = validateNewSection(sections, name, parentId)
  if (problem) throw new Error(problem)
  const parent = parentId || null
  const order = nextOrder(sections.filter((s) => (s.parentId ?? null) === parent))
  const id = await saveSection({ name, parentId: parent }, order)
  return { id, name: name.trim(), slug: slugify(name), parentId: parent, order, visible: true }
}

/**
 * Crea varias secciones nuevas en UN lote con bitácora. `nodes` viene de `buildImportPlan`
 * (`created`): cada nodo trae su `parentKey` ('' = principal, 'e:ID' = existente, 'n:N' = nuevo).
 */
export async function importSections(nodes) {
  const ids = new Map()
  const ops = nodes.map((node) => {
    const ref = newDocRef('sections')
    ids.set(node.key, ref.id)
    const parentId = node.parentKey.startsWith('e:')
      ? node.parentKey.slice(2)
      : node.parentKey
        ? ids.get(node.parentKey)
        : null
    return {
      type: 'set',
      ref,
      data: {
        name: node.name.trim(),
        slug: slugify(node.name),
        parentId,
        order: node.order,
        visible: true,
      },
    }
  })
  await commitWithAudit(ops, {
    action: 'crear',
    collection: 'sections',
    docId: '',
    summary: cut(
      `Carga masiva de ${nodes.length} secciones: ${nodes
        .slice(0, 8)
        .map((n) => n.name)
        .join(', ')}${nodes.length > 8 ? '…' : ''}`,
    ),
  })
}

/** Intercambia el orden de dos secciones hermanas. */
export function swapSectionOrder(a, b) {
  return commitWithAudit(
    [
      { type: 'update', ref: docRef('sections', a.id), data: { order: b.order } },
      { type: 'update', ref: docRef('sections', b.id), data: { order: a.order } },
    ],
    {
      action: 'reordenar',
      collection: 'sections',
      docId: a.id,
      summary: cut(`"${a.name}" y "${b.name}" intercambian posición`),
    },
  )
}
/**
 * Guarda un nuevo orden de secciones hermanas (`ordered`, ya en su orden final) en UN lote con
 * bitácora. Solo se escriben las que cambian de posición; el `order` queda 0, 1, 2…
 */
export async function reorderSections(ordered, movedName = '') {
  const changes = ordered
    .map((s, order) => ({ s, order }))
    .filter(({ s, order }) => s.order !== order)
  if (changes.length === 0) return
  await commitWithAudit(
    changes.map(({ s, order }) => ({
      type: 'update',
      ref: docRef('sections', s.id),
      data: { order },
    })),
    {
      action: 'reordenar',
      collection: 'sections',
      docId: ordered[0].id,
      summary: cut(`Nuevo orden de secciones${movedName ? `: se movió "${movedName}"` : ''}`),
    },
  )
}

export function setSectionVisible(section, visible) {
  return commitWithAudit(
    [{ type: 'update', ref: docRef('sections', section.id), data: { visible } }],
    {
      action: visible ? 'mostrar' : 'ocultar',
      collection: 'sections',
      docId: section.id,
      summary: cut(`Sección "${section.name}"`),
    },
  )
}

/** Elimina una sección solo si no tiene subsecciones ni camisas. Lanza un Error con el motivo. */
export async function deleteSection(section, allSections) {
  if (allSections.some((s) => s.parentId === section.id)) {
    throw new Error('Primero elimina o mueve sus subsecciones.')
  }
  const used = await getDocs(
    query(collection(db, 'products'), where('sectionIds', 'array-contains', section.id), limit(1)),
  )
  if (!used.empty) throw new Error('Hay camisas en esta sección. Quítalas de ella o ocúltala.')
  await commitWithAudit([{ type: 'delete', ref: docRef('sections', section.id) }], {
    action: 'eliminar',
    collection: 'sections',
    docId: section.id,
    summary: cut(`Sección "${section.name}"`),
  })
}

// ---------- Hashtags ----------

/**
 * Crea hashtags nuevos (los que se escribieron en el formulario de una camisa) en un solo lote.
 * `tags`: [{ id, name }] con `id` = slug del nombre. Los alias empiezan vacíos.
 */
export async function createTags(tags) {
  if (tags.length === 0) return
  await commitWithAudit(
    tags.map((t) => ({
      type: 'set',
      ref: docRef('tags', t.id),
      data: { name: t.name.trim(), aliases: [], createdAt: serverTimestamp() },
    })),
    {
      action: 'crear',
      collection: 'tags',
      docId: tags.length === 1 ? tags[0].id : '',
      summary: cut(`Hashtags: ${tags.map((t) => `#${t.name}`).join(' ')}`),
    },
  )
}

// ---------- Grupos de parches ----------

export async function savePatchGroup(group, count = 0) {
  const isNew = !group.id
  const ref = isNew ? newDocRef('patchGroups') : docRef('patchGroups', group.id)
  const data = {
    name: group.name.trim(),
    order: isNew ? count : group.order,
    options: group.options.map((o) => ({
      name: o.name.trim(),
      image: o.image || '',
      price: o.price,
    })),
  }
  await commitWithAudit([{ type: 'set', ref, data }], {
    action: isNew ? 'crear' : 'editar',
    collection: 'patchGroups',
    docId: ref.id,
    summary: cut(`Grupo de parches "${data.name}" (${data.options.length} opciones)`),
  })
  return ref.id
}

export async function deletePatchGroup(group) {
  const used = await getDocs(
    query(collection(db, 'products'), where('patchGroupIds', 'array-contains', group.id), limit(1)),
  )
  if (!used.empty) throw new Error('Hay camisas que usan este grupo. Quítalo de ellas primero.')
  await commitWithAudit([{ type: 'delete', ref: docRef('patchGroups', group.id) }], {
    action: 'eliminar',
    collection: 'patchGroups',
    docId: group.id,
    summary: cut(`Grupo de parches "${group.name}"`),
  })
}

// ---------- Recargos estándar ----------

/** Documento privado (solo admin) con el costo del proveedor que se propone al crear una camisa. */
export const DEFAULTS_DOC_ID = '_defaults'

/**
 * Guarda los recargos estándar (settings/sizeSurcharges): por talla (solo las que tienen recargo)
 * y por personalización con nombre y número. También guarda los valores que se proponen al crear una
 * camisa: el precio base (público, junto a los recargos) y el costo del proveedor (privado, en
 * `productPrivate/_defaults`, porque `settings` lo puede leer cualquiera).
 */
export function saveSurcharges({ sizes, personalization, basePrice = 0, supplierCost = 0 }) {
  const values = Object.fromEntries(SIZES.filter((s) => sizes[s] > 0).map((s) => [s, sizes[s]]))
  const custom = personalization > 0 ? personalization : 0
  const price = basePrice > 0 ? basePrice : 0
  const cost = supplierCost > 0 ? supplierCost : 0
  return commitWithAudit(
    [
      {
        type: 'set',
        ref: docRef('settings', 'sizeSurcharges'),
        data: { values, personalization: custom, basePrice: price },
      },
      { type: 'set', ref: docRef('productPrivate', DEFAULTS_DOC_ID), data: { cost } },
    ],
    {
      action: 'editar',
      collection: 'settings',
      docId: 'sizeSurcharges',
      summary: cut(
        `Recargos estándar: ${
          Object.entries(values)
            .map(([s, v]) => `${s} ${v}`)
            .join(', ') || 'sin recargo por talla'
        }; personalización ${custom}; precio base ${price}; costo proveedor ${cost}`,
      ),
    },
  )
}

// ---------- Competiciones ----------

export async function saveCompetition(competition, count = 0) {
  const isNew = !competition.id
  const ref = isNew ? newDocRef('competitions') : docRef('competitions', competition.id)
  const data = { name: competition.name.trim(), order: isNew ? count : competition.order }
  await commitWithAudit([{ type: 'set', ref, data }], {
    action: isNew ? 'crear' : 'editar',
    collection: 'competitions',
    docId: ref.id,
    summary: cut(`Competición "${data.name}"`),
  })
  return ref.id
}

export async function deleteCompetition(competition) {
  const used = await getDocs(
    query(
      collection(db, 'products'),
      where('competitionIds', 'array-contains', competition.id),
      limit(1),
    ),
  )
  if (!used.empty)
    throw new Error('Hay camisas que usan esta competición. Quítala de ellas primero.')
  await commitWithAudit([{ type: 'delete', ref: docRef('competitions', competition.id) }], {
    action: 'eliminar',
    collection: 'competitions',
    docId: competition.id,
    summary: cut(`Competición "${competition.name}"`),
  })
}

// ---------- Guía de tallas ----------

/** Guarda una categoría de la guía de tallas (medidas siempre en cm). */
export async function saveSizeChart(chart, count = 0) {
  const isNew = !chart.id
  const ref = isNew ? newDocRef('sizeCharts') : docRef('sizeCharts', chart.id)
  const data = {
    name: chart.name.trim(),
    note: (chart.note ?? '').trim(),
    order: isNew ? count : chart.order,
    measures: chart.measures.map((m) => m.trim()),
    kinds: kindsOf(chart),
    rows: chart.rows.map((r) => ({ size: r.size.trim(), values: r.values.map(toCell) })),
  }
  await commitWithAudit([{ type: 'set', ref, data }], {
    action: isNew ? 'crear' : 'editar',
    collection: 'sizeCharts',
    docId: ref.id,
    summary: cut(`Guía de tallas "${data.name}"`),
  })
  return ref.id
}

export function deleteSizeChart(chart) {
  return commitWithAudit([{ type: 'delete', ref: docRef('sizeCharts', chart.id) }], {
    action: 'eliminar',
    collection: 'sizeCharts',
    docId: chart.id,
    summary: cut(`Guía de tallas "${chart.name}"`),
  })
}

/**
 * Carga las guías iniciales en un solo lote (con bitácora). Si ya existe una con el mismo
 * nombre, la actualiza en su lugar; las demás se agregan al final.
 */
export function seedSizeCharts(charts, existing = []) {
  const byName = new Map(existing.map((c) => [normalizeText(c.name), c]))
  let order = nextOrder(existing)
  return commitWithAudit(
    charts.map((c) => {
      const old = byName.get(normalizeText(c.name))
      if (old)
        return { type: 'set', ref: docRef('sizeCharts', old.id), data: { ...c, order: old.order } }
      const data = { ...c, order }
      order += 1
      return { type: 'set', ref: newDocRef('sizeCharts'), data }
    }),
    {
      action: 'crear',
      collection: 'sizeCharts',
      docId: '',
      summary: cut(
        `Guías de tallas cargadas (${charts.length}): ${charts.map((c) => c.name).join(', ')}`,
      ),
    },
  )
}

// ---------- Camisas ----------

/**
 * Guarda una camisa y su costo privado en un solo lote. En edición no se tocan createdAt ni
 * sale (la oferta la maneja la subtarea 8).
 */
export async function saveProduct(product, cost, variantCosts = {}) {
  const isNew = !product.id
  const ref = isNew ? newDocRef('products') : docRef('products', product.id)
  const cleanedVariants = Array.isArray(product.variants)
    ? product.variants.map((v) => cleanVariantForSave(v, v))
    : []

  const base = {
    name: product.name.trim(),
    description: product.description.trim(),
    price: product.price,
    sectionIds: product.sectionIds,
    tagIds: product.tagIds,
    images: product.images,
    patchGroupIds: product.patchGroupIds,
    disabledPatches: cleanDisabledPatches(product.disabledPatches, usedPatchGroupIds(product)),
    competitionIds: product.competitionIds ?? [],
    sizeSurcharges: product.sizeSurcharges ?? {},
    // Sin `surcharge` = usa el estándar de la tienda (Firestore no admite `undefined`).
    personalization: {
      enabled: Boolean(product.personalization?.enabled),
      ...(product.personalization?.surcharge != null
        ? { surcharge: product.personalization.surcharge }
        : {}),
    },
    visible: product.visible,
    updatedAt: serverTimestamp(),
  }

  if (product.baseVariantName?.trim()) {
    base.baseVariantName = product.baseVariantName.trim()
  } else if (!isNew) {
    base.baseVariantName = deleteField()
  }

  if (product.sizeChartId?.trim()) {
    base.sizeChartId = product.sizeChartId.trim()
  } else if (!isNew) {
    base.sizeChartId = deleteField()
  }

  if (
    Array.isArray(product.sizes) &&
    product.sizes.length > 0 &&
    !areSizesStandard(product.sizes)
  ) {
    base.sizes = normalizeSizes(product.sizes)
  } else if (!isNew) {
    base.sizes = deleteField()
  }

  if (cleanedVariants.length > 0) {
    base.variants = cleanedVariants
  } else if (!isNew) {
    base.variants = deleteField()
  }

  const productOp = isNew
    ? {
        type: 'set',
        ref,
        data: { ...base, sale: null, deleted: false, createdAt: serverTimestamp() },
      }
    : { type: 'update', ref, data: base }

  const privateData = {
    cost,
    margin: product.price - cost,
  }
  const cleanVC = cleanVariantCosts(cleanedVariants, variantCosts)
  if (Object.keys(cleanVC).length > 0) {
    privateData.variantCosts = cleanVC
  }

  await commitWithAudit(
    [
      productOp,
      {
        type: 'set',
        ref: docRef('productPrivate', ref.id),
        data: privateData,
      },
    ],
    {
      action: isNew ? 'crear' : 'editar',
      collection: 'products',
      docId: ref.id,
      summary: cut(`Camisa "${base.name}"`),
    },
  )
  return ref.id
}

/** Acciones masivas sobre varias camisas: visibilidad, eliminar (soft delete) o restaurar. */
export function bulkUpdateProducts(products, patch, actionLabel) {
  return commitWithAudit(
    products.map((p) => ({
      type: 'update',
      ref: docRef('products', p.id),
      data: { ...patch, updatedAt: serverTimestamp() },
    })),
    {
      action: actionLabel,
      collection: 'products',
      docId: products.length === 1 ? products[0].id : '',
      summary: cut(`${products.length} camisa(s): ${products.map((p) => p.name).join(', ')}`),
    },
  )
}
