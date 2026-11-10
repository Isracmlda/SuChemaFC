import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MdAdd, MdArrowDownward, MdArrowUpward, MdClose } from 'react-icons/md'
import CheckList from '../../../components/CheckList.jsx'
import Collapsible from '../../../components/Collapsible.jsx'
import CollapsibleCard from '../../../components/CollapsibleCard.jsx'
import Field from '../../../components/Field.jsx'
import Modal from '../../../components/Modal.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import {
  DEFAULTS_DOC_ID,
  createSection,
  createTags,
  saveProduct,
} from '../../../services/catalog.js'
import { getDocData, listCollection } from '../../../services/db.js'
import { MAX_PRODUCT_IMAGES, SIZES } from '../../../utils/constants.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, slugify } from '../../../utils/format.js'
import { nextOrder } from '../../../utils/tree.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { usedPatchGroupIds } from '../../catalog/patches.js'
import { DEFAULT_BASE_VARIANT_NAME } from '../../catalog/variants.js'
import { sectionPath } from '../../catalog/search.js'
import {
  buildDraft,
  clearDraft,
  draftSignature,
  fromDraftProduct,
  loadDraft,
  saveDraft,
} from './draft.js'
import ImagesEditor from './ImagesEditor.jsx'
import PatchGroupEditor from './PatchGroupEditor.jsx'
import PatchOptionsEditor from './PatchOptionsEditor.jsx'
import SectionSelector from './SectionSelector.jsx'
import SizeSurchargesEditor from './SizeSurchargesEditor.jsx'
import VariantEditor from './VariantEditor.jsx'
import VisibleSizesEditor from './VisibleSizesEditor.jsx'
import { filterPatchGroups, RECENT_LIMIT } from './patchFilter.js'
import { chartSizes, findDefaultChart } from '../../sizeChart/chart.js'
import { RECENT_TAGS, suggestTags, typedToken } from './tagFilter.js'
import {
  applyChartSizes,
  makeVariantId,
  validateChartId,
  validateSizes,
  validateVariants,
} from './productAdmin.js'

const EMPTY = {
  name: '',
  description: '',
  price: 0,
  baseVariantName: '',
  sizes: undefined,
  variants: [],
  sectionIds: [],
  tagIds: [],
  images: [],
  patchGroupIds: [],
  disabledPatches: {},
  competitionIds: [],
  sizeSurcharges: {},
  personalization: { enabled: false },
  visible: true,
}

async function loadOptions() {
  const [sections, tags, patchGroups, competitions, standard, sizeCharts, defaults] =
    await Promise.all([
      listCollection('sections'),
      listCollection('tags'),
      listCollection('patchGroups'),
      listCollection('competitions').catch(() => []),
      getDocData('settings', 'sizeSurcharges').catch(() => null),
      listCollection('sizeCharts').catch(() => []),
      getDocData('productPrivate', DEFAULTS_DOC_ID).catch(() => null),
    ])
  return {
    sections,
    tags,
    patchGroups,
    competitions,
    standard: {
      sizes: standard?.values ?? {},
      personalization: standard?.personalization ?? 0,
      basePrice: standard?.basePrice ?? 0,
      supplierCost: defaults?.cost ?? 0,
    },
    sizeCharts: (sizeCharts ?? []).sort((a, b) => a.order - b.order),
  }
}

function toggle(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/** "#Seleccion #LaLiga, mundial" -> ['Seleccion', 'LaLiga', 'mundial'] (sin # y sin vacíos). */
function parseHashtags(text) {
  return String(text)
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim())
    .filter((t) => slugify(t))
}

/**
 * Toda camisa lleva guía de tallas: la que ya tiene si existe, y si no (camisa nueva o sin guía) la
 * «Camiseta hombre · Versión aficionado»; sin ella, la primera guía disponible.
 */
function withChart(product, charts) {
  if (charts.some((c) => c.id === product.sizeChartId)) return product
  return { ...product, sizeChartId: (findDefaultChart(charts) ?? charts[0])?.id }
}

/** Formulario de creación y edición de camisa. `productId` vacío = nueva. */
export default function ProductForm({ productId, onDone }) {
  const load = useCallback(async () => {
    const options = await loadOptions()
    if (!productId) {
      // Una camisa nueva parte del precio base y del costo del proveedor fijados en Recargos.
      return {
        ...options,
        product: withChart({ ...EMPTY, price: options.standard.basePrice }, options.sizeCharts),
        cost: options.standard.supplierCost,
        variantCosts: {},
      }
    }
    const [product, priv] = await Promise.all([
      getDocData('products', productId),
      getDocData('productPrivate', productId),
    ])
    return {
      ...options,
      product: withChart({ ...EMPTY, ...product }, options.sizeCharts),
      cost: priv?.cost ?? 0,
      variantCosts: priv?.variantCosts ?? {},
    }
  }, [productId])
  const { data, loading, error, reload } = useAsync(load)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return <FormBody key={productId ?? 'new'} productId={productId} data={data} onDone={onDone} />
}

function FormBody({ productId, data, onDone }) {
  // Borrador guardado en este navegador (si lo hay): se recupera sobre lo cargado de Firestore.
  const [recovered] = useState(() => loadDraft(productId))
  const [saved] = useState(() => data)
  const draft = recovered?.draft
  const [p, setP] = useState(() =>
    draft
      ? withChart(fromDraftProduct(data.product, draft.product), data.sizeCharts)
      : data.product,
  )
  const [cost, setCost] = useState(draft ? draft.cost : data.cost)
  const [variantCosts, setVariantCosts] = useState(
    draft ? draft.variantCosts : (data.variantCosts ?? {}),
  )
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [draftNote, setDraftNote] = useState(Boolean(draft))

  const [sections, setSections] = useState(data.sections)
  const [pick, setPick] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const sectionPanelId = useId()
  const personalizationPanelId = useId()

  // Hashtags: los existentes más los escritos aquí (`pendingIds`), que se crean al guardar.
  const draftTags = draft?.pendingTags ?? []
  const [tags, setTags] = useState(() => [
    ...data.tags,
    ...draftTags.filter((t) => !data.tags.some((x) => x.id === t.id)),
  ])
  const [pendingIds, setPendingIds] = useState(() => draftTags.map((t) => t.id))
  const [tagText, setTagText] = useState('')

  const [patchGroups, setPatchGroups] = useState(data.patchGroups)
  const [patchModal, setPatchModal] = useState(false)
  const [patchQuery, setPatchQuery] = useState('')
  const [patchMode, setPatchMode] = useState('recientes')

  const sectionLabel = (id) => {
    const path = sectionPath(sections, id)
    return path.length ? path.map((s) => s.name).join(' › ') : '(sección eliminada)'
  }
  async function handleCreateSection(input) {
    const created = await createSection(input, sections)
    setSections((prev) => [...prev, created])
    return created
  }
  const pickParent = pick ? sectionPath(sections, pick).at(-1) : null

  const set = (patch) => setP((prev) => ({ ...prev, ...patch }))

  // ---------- Hashtags ----------
  const tagName = (id) => tags.find((t) => t.id === id)?.name ?? id
  const typedQuery = slugify(typedToken(tagText))
  const suggestions = suggestTags(tags, { text: tagText, selectedIds: p.tagIds, pendingIds })

  // Al marcar una sugerencia se quita de lo escrito la palabra a medias que la buscaba.
  function pickSuggestion(id) {
    addTagIds([id])
    setTagText((text) => text.replace(/[^\s,]*$/, ''))
  }

  function addTagIds(ids) {
    setP((prev) => ({ ...prev, tagIds: [...new Set([...prev.tagIds, ...ids])] }))
  }
  function commitTagText() {
    const names = parseHashtags(tagText)
    if (names.length === 0) return
    const fresh = []
    for (const name of names) {
      const id = slugify(name)
      if (!tags.some((t) => t.id === id) && !fresh.some((t) => t.id === id)) {
        fresh.push({ id, name, aliases: [] })
      }
    }
    if (fresh.length > 0) {
      setTags((prev) => [...prev, ...fresh])
      setPendingIds((prev) => [...prev, ...fresh.map((t) => t.id)])
    }
    addTagIds(names.map(slugify))
    setTagText('')
  }

  // ---------- Borrador automático ----------
  const baselineSignature = useMemo(
    () =>
      draftSignature(
        buildDraft({
          product: saved.product,
          cost: saved.cost,
          variantCosts: saved.variantCosts,
          pendingTags: [],
        }),
      ),
    [saved],
  )
  const currentDraft = buildDraft({
    product: p,
    cost,
    variantCosts,
    pendingTags: tags.filter((t) => pendingIds.includes(t.id) && p.tagIds.includes(t.id)),
  })
  const dirty = draftSignature(currentDraft) !== baselineSignature
  // Siempre apunta al estado actual para guardar al salir sin depender de cierres viejos.
  const latest = useRef({ dirty, currentDraft })
  useEffect(() => {
    latest.current = { dirty, currentDraft }
  })
  const keepDraft = useRef(true)

  useEffect(() => {
    const flush = () => {
      if (!keepDraft.current) return
      if (latest.current.dirty) saveDraft(productId, latest.current.currentDraft)
      else clearDraft(productId)
    }
    // Mientras se edita, se guarda poco después del último cambio.
    const timer = setTimeout(flush, 500)
    return () => clearTimeout(timer)
  }, [p, cost, variantCosts, tags, pendingIds, productId])

  useEffect(() => {
    const flush = () => {
      if (!keepDraft.current) return
      if (latest.current.dirty) saveDraft(productId, latest.current.currentDraft)
      else clearDraft(productId)
    }
    // Al cerrar la pestaña o salir de la pantalla (otra sección de la página) el borrador queda guardado.
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [productId])

  function discardDraft() {
    clearDraft(productId)
    setP(saved.product)
    setCost(saved.cost)
    setVariantCosts(saved.variantCosts ?? {})
    setTags(saved.tags)
    setPendingIds([])
    setDraftNote(false)
  }

  // ---------- Parches ----------
  function handlePatchGroupSaved(group) {
    setPatchGroups((prev) => [...prev, group])
    set({ patchGroupIds: [...p.patchGroupIds, group.id] })
    setPatchModal(false)
  }
  const shownGroups = filterPatchGroups(patchGroups, {
    query: patchQuery,
    mode: patchMode,
    selectedIds: p.patchGroupIds,
  })

  // ---------- Recargo de personalización ----------
  const customOverridden = p.personalization.surcharge != null
  const customSurcharge = p.personalization.surcharge ?? data.standard.personalization
  function setCustomSurcharge(value) {
    const next = { enabled: p.personalization.enabled }
    if (value !== data.standard.personalization) next.surcharge = value
    set({ personalization: next })
  }

  // ---------- Versiones ----------
  // Versión que se está editando (null = la versión base). Si desaparece, se vuelve a la base.
  const [activeId, setActiveId] = useState(null)
  const activeIndex = (p.variants ?? []).findIndex((v) => v.id === activeId)
  const activeVariant = activeIndex >= 0 ? p.variants[activeIndex] : null

  function handleAddVariant() {
    const id = makeVariantId()
    const newVariant = {
      id,
      name: '',
      visible: true,
    }
    set({ variants: [...(p.variants ?? []), newVariant] })
    setActiveId(id)
  }

  function handleUpdateVariant(index, updated) {
    const next = [...(p.variants ?? [])]
    next[index] = updated
    set({ variants: next })
  }

  function handleUpdateVariantCost(variantId, variantCost) {
    setVariantCosts((prev) => {
      const next = { ...prev }
      if (variantCost == null || variantCost === '') {
        delete next[variantId]
      } else {
        next[variantId] = variantCost
      }
      return next
    })
  }

  function handleMoveVariant(i, dir) {
    const list = [...(p.variants ?? [])]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set({ variants: list })
  }

  function handleRemoveVariant(index, variantId) {
    const list = (p.variants ?? []).filter((_, i) => i !== index)
    set({ variants: list })
    setActiveId(null)
    setVariantCosts((prev) => {
      const next = { ...prev }
      delete next[variantId]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (p.sectionIds.length === 0) {
      setNotice({ type: 'error', text: 'Elige al menos una sección.' })
      return
    }

    const tooManyImages = [
      { name: 'La camisa', images: p.images },
      ...(p.variants ?? []).map((v) => ({ name: `La versión «${v.name}»`, images: v.images })),
    ].find((x) => (x.images?.length ?? 0) > MAX_PRODUCT_IMAGES)
    if (tooManyImages) {
      setNotice({
        type: 'error',
        text: `${tooManyImages.name} tiene ${tooManyImages.images.length} imágenes y el máximo es ${MAX_PRODUCT_IMAGES}. Quita las que sobren.`,
      })
      return
    }

    if (!p.sizeChartId) {
      setNotice({
        type: 'error',
        text: 'Elige la guía de tallas de la camisa. Si no hay ninguna, créala en Predeterminados › Tallas.',
      })
      return
    }

    const chartErr = validateChartId(
      p.sizeChartId,
      data.sizeCharts.map((c) => c.id),
    )
    if (chartErr) {
      setNotice({ type: 'error', text: chartErr })
      return
    }

    if (p.sizes != null) {
      const sizesErr = validateSizes(p.sizes, 'Camisa base')
      if (sizesErr) {
        setNotice({ type: 'error', text: sizesErr })
        return
      }
    }

    if (p.variants?.length > 0) {
      const variantsErr = validateVariants(
        p.variants,
        data.sizeCharts.map((c) => c.id),
      )
      if (variantsErr) {
        setNotice({ type: 'error', text: variantsErr })
        return
      }
    }

    setBusy(true)
    setNotice(null)
    try {
      await createTags(
        pendingIds.filter((id) => p.tagIds.includes(id)).map((id) => ({ id, name: tagName(id) })),
      )
      // Las tallas guardadas se ajustan a la guía asignada a la camisa y a cada versión.
      await saveProduct(applyChartSizes(p, data.sizeCharts), cost, variantCosts)
      keepDraft.current = false
      clearDraft(productId)
      onDone()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  const competitionItems = [...data.competitions]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ id: c.id, label: c.name }))
  const patchItems = shownGroups.map((g) => ({ id: g.id, label: g.name }))
  const baseChart = data.sizeCharts.find((c) => c.id === p.sizeChartId) ?? null
  const baseChartSizes = chartSizes(baseChart)
  const visibleSizes = baseChart
    ? (() => {
        const picked = baseChartSizes.filter((s) => p.sizes?.includes(s))
        return picked.length > 0 ? picked : baseChartSizes
      })()
    : p.sizes?.length
      ? p.sizes
      : SIZES

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h2 className="sr-only">{p.id ? 'Editar camisa' : 'Nueva camisa'}</h2>
        {draftNote && (
          <div
            role="status"
            className={`${cardClass} flex flex-wrap items-center justify-between gap-3 border-accent`}
          >
            <p className="text-sm">
              Recuperamos tu borrador sin guardar
              {recovered?.savedAt
                ? ` (${new Date(recovered.savedAt).toLocaleString('es-CR')})`
                : ''}
              . Se guarda solo mientras editas.
            </p>
            <button type="button" onClick={discardDraft} className={btnSecondary}>
              Descartar borrador
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            required
            aria-label="Nombre de la camisa"
            value={p.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={p.id ? 'Nombre de la camisa' : 'Nueva camisa: escribe el nombre'}
            maxLength={150}
            className={`${inputClass} !min-h-14 min-w-0 flex-1 basis-60 text-xl font-bold`}
          />
          <button
            type="button"
            onClick={handleAddVariant}
            className={`${btnSecondary} !min-h-14 shrink-0`}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar versión
          </button>
        </div>

        {p.variants?.length > 0 && (
          <div
            role="group"
            aria-label="Versión que estás editando"
            className="flex flex-wrap gap-2"
          >
            {[{ id: null, label: p.baseVariantName || DEFAULT_BASE_VARIANT_NAME }]
              .concat(p.variants.map((v, i) => ({ id: v.id, label: v.name || `Versión ${i + 1}` })))
              .map((option) => {
                const selected = (activeVariant?.id ?? null) === option.id
                return (
                  <button
                    key={option.id ?? 'base'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveId(option.id)}
                    className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-accent bg-accent/10 text-fg'
                        : 'border-border text-muted hover:border-border-strong'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
          </div>
        )}

        {activeVariant && (
          <section className={cardClass}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-semibold">
                Versión «{activeVariant.name || 'sin nombre'}»
                <span className="ms-2 text-sm font-normal text-muted">
                  Lo que dejes marcado como «Usar la de la versión base» se toma de la versión{' '}
                  {p.baseVariantName || DEFAULT_BASE_VARIANT_NAME}.
                </span>
              </h3>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label="Mover esta versión antes"
                  disabled={activeIndex === 0}
                  onClick={() => handleMoveVariant(activeIndex, -1)}
                  className={btnIcon}
                >
                  <MdArrowUpward className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Mover esta versión después"
                  disabled={activeIndex === p.variants.length - 1}
                  onClick={() => handleMoveVariant(activeIndex, 1)}
                  className={btnIcon}
                >
                  <MdArrowDownward className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <VariantEditor
              key={activeVariant.id}
              variant={activeVariant}
              baseProduct={p}
              baseCost={cost}
              variantCost={variantCosts[activeVariant.id]}
              sizeCharts={data.sizeCharts}
              patchGroups={patchGroups}
              standardSurcharges={data.standard}
              onChange={(updated) => handleUpdateVariant(activeIndex, updated)}
              onCostChange={(c) => handleUpdateVariantCost(activeVariant.id, c)}
              onRemove={() => handleRemoveVariant(activeIndex, activeVariant.id)}
            />
          </section>
        )}

        {!activeVariant && (
          <>
            <CollapsibleCard
              title="Descripción, precio e imágenes"
              actions={
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={p.visible}
                    onChange={(e) => set({ visible: e.target.checked })}
                    className="size-4 accent-[var(--accent-solid)]"
                  />
                  Visible para los clientes
                </label>
              }
            >
              <div className="grid gap-4 md:grid-cols-5">
                <div className="flex flex-col gap-3 md:col-span-3">
                  <Field label="Descripción">
                    <textarea
                      value={p.description}
                      onChange={(e) => set({ description: e.target.value })}
                      rows={5}
                      maxLength={2000}
                      className={`${inputClass} py-2`}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Precio base (₡)">
                      <NumberInput required value={p.price} onChange={(price) => set({ price })} />
                    </Field>
                    <Field label="Costo del proveedor (₡)">
                      <NumberInput value={cost} onChange={setCost} />
                    </Field>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:col-span-2">
                  <ImagesEditor
                    images={p.images}
                    onChange={(images) => set({ images })}
                    label="Imágenes"
                    hint="La primera es la portada."
                  />
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="Secciones"
              actions={
                <button
                  type="button"
                  aria-expanded={creatingSection}
                  aria-controls={sectionPanelId}
                  onClick={() => setCreatingSection((open) => !open)}
                  className={`${btnSecondary} max-w-56 py-1 text-start leading-tight`}
                >
                  <MdAdd className="size-5 shrink-0" aria-hidden="true" />
                  {pickParent
                    ? `Nueva subsección en «${pickParent.name}»`
                    : 'Nueva sección principal'}
                </button>
              }
            >
              {p.sectionIds.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Secciones elegidas">
                  {p.sectionIds.map((id) => (
                    <li
                      key={id}
                      className="inline-flex min-h-11 items-center gap-1 rounded-md border border-accent bg-surface-2 ps-3 text-sm font-semibold"
                    >
                      {sectionLabel(id)}
                      <button
                        type="button"
                        aria-label={`Quitar ${sectionLabel(id)}`}
                        onClick={() => set({ sectionIds: p.sectionIds.filter((x) => x !== id) })}
                        className="inline-flex size-10 items-center justify-center rounded-md hover:text-accent"
                      >
                        <MdClose className="size-5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <SectionSelector
                sections={sections}
                value={pick}
                onChange={setPick}
                onCreate={handleCreateSection}
                creating={creatingSection}
                createPanelId={sectionPanelId}
                action={
                  <button
                    type="button"
                    disabled={!pick || p.sectionIds.includes(pick)}
                    title={pick ? `Agregar «${sectionLabel(pick)}» a la camisa` : undefined}
                    onClick={() => {
                      set({ sectionIds: [...p.sectionIds, pick] })
                      setPick('')
                    }}
                    className={`${btnSecondary} shrink-0 max-sm:w-full`}
                  >
                    <MdAdd className="size-5" aria-hidden="true" />
                    Agregar
                  </button>
                }
              />
              {p.sectionIds.length === 0 && (
                <p className="text-sm text-muted">
                  Elige al menos una sección y pulsa «Agregar» para asignarla a la camisa.
                </p>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Hashtags">
              {p.tagIds.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Hashtags de la camisa">
                  {p.tagIds.map((id) => (
                    <li
                      key={id}
                      className="inline-flex min-h-11 items-center gap-1 rounded-md border border-accent bg-surface-2 ps-3 text-sm font-semibold"
                    >
                      #{tagName(id)}
                      <button
                        type="button"
                        aria-label={`Quitar #${tagName(id)}`}
                        onClick={() => set({ tagIds: p.tagIds.filter((x) => x !== id) })}
                        className="inline-flex size-10 items-center justify-center rounded-md hover:text-accent"
                      >
                        <MdClose className="size-5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Escribir hashtags"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      commitTagText()
                    }
                  }}
                  placeholder="#Seleccion  #LaLiga  #Mundial2026"
                  maxLength={120}
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={parseHashtags(tagText).length === 0}
                  onClick={commitTagText}
                  className={btnSecondary}
                >
                  <MdAdd className="size-5" aria-hidden="true" />
                  Agregar
                </button>
              </div>
              <p className="text-sm text-muted">
                Escríbelos con # y sepáralos con espacio. Los que no existan se crean al guardar y
                sirven para encontrar la camisa en la búsqueda.
              </p>
              {typedQuery && suggestions.length === 0 && (
                <p className="text-sm text-muted">
                  Ningún hashtag existente coincide: se creará uno nuevo al agregarlo.
                </p>
              )}
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    {typedQuery ? 'Hashtags que coinciden' : `Últimos ${RECENT_TAGS} hashtags`}
                  </span>
                  <ul className="flex flex-wrap gap-2">
                    {suggestions.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => pickSuggestion(t.id)}
                          className="min-h-11 rounded-md border border-border-strong px-3 text-sm hover:border-accent"
                        >
                          #{t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              title="Grupos de parches"
              actions={
                <button type="button" onClick={() => setPatchModal(true)} className={btnSecondary}>
                  <MdAdd className="size-5" aria-hidden="true" />
                  Crear grupo
                </button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Buscar" className="sm:col-span-2">
                  <input
                    type="search"
                    value={patchQuery}
                    onChange={(e) => setPatchQuery(e.target.value)}
                    placeholder="Nombre del grupo o del parche"
                    className={inputClass}
                  />
                </Field>
                <Field label="Mostrar">
                  <select
                    value={patchMode}
                    onChange={(e) => setPatchMode(e.target.value)}
                    className={inputClass}
                  >
                    <option value="recientes">Últimos {RECENT_LIMIT} agregados</option>
                    <option value="elegidos">
                      Elegidos en esta camisa ({p.patchGroupIds.length})
                    </option>
                    <option value="todos">Todos ({patchGroups.length})</option>
                  </select>
                </Field>
              </div>
              <CheckList
                legend="Grupos de parches aplicables"
                items={patchItems}
                selected={p.patchGroupIds}
                onToggle={(id) => set({ patchGroupIds: toggle(p.patchGroupIds, id) })}
                empty={
                  patchGroups.length === 0
                    ? 'Aún no hay grupos de parches.'
                    : 'Ningún grupo coincide con la búsqueda.'
                }
              />
              {patchMode === 'recientes' &&
                !patchQuery.trim() &&
                patchGroups.length > RECENT_LIMIT && (
                  <p className="text-sm text-muted">
                    Se muestran los últimos {RECENT_LIMIT} de {patchGroups.length}. Usa el buscador
                    o «Todos» para ver el resto.
                  </p>
                )}
              <PatchOptionsEditor
                groups={usedPatchGroupIds(p)
                  .map((id) => patchGroups.find((g) => g.id === id))
                  .filter(Boolean)}
                disabledPatches={p.disabledPatches ?? {}}
                onChange={(disabledPatches) => set({ disabledPatches })}
              />
            </CollapsibleCard>

            <CollapsibleCard title="Tallas, recargos y personalización">
              <Field
                label="Guía de tallas de la versión base"
                hint="La guía que verá el cliente con esta versión. Sus tallas son las que puedes ofrecer. Las versiones adicionales pueden usar otra."
              >
                <select
                  required
                  value={p.sizeChartId ?? ''}
                  // Las tallas pertenecen a la guía: al cambiarla se vuelven a elegir.
                  onChange={(e) =>
                    set({ sizeChartId: e.target.value || undefined, sizes: undefined })
                  }
                  className={inputClass}
                >
                  {!p.sizeChartId && <option value="">Elige una guía de tallas</option>}
                  {data.sizeCharts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <VisibleSizesEditor
                value={p.sizes}
                onChange={(sizes) => set({ sizes })}
                label="Tallas visibles de la versión base"
                chart={baseChart}
              />

              <hr className="my-2 border-border" />

              <p className="text-sm text-muted">
                Recargos por talla. Parten de los recargos estándar de la tienda (Predeterminados ›
                Recargos). Cámbialos aquí solo si esta camisa es distinta.
              </p>
              <SizeSurchargesEditor
                sizes={visibleSizes}
                surcharges={p.sizeSurcharges}
                standardSizes={data.standard.sizes}
                onChange={(sizeSurcharges) => set({ sizeSurcharges })}
              />

              <hr className="my-2 border-border" />

              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={p.personalization.enabled}
                  aria-controls={personalizationPanelId}
                  onChange={(e) =>
                    set({ personalization: { ...p.personalization, enabled: e.target.checked } })
                  }
                  className="size-4 accent-[var(--accent-solid)]"
                />
                Permite personalizar (nombre y número)
              </label>
              <Collapsible open={p.personalization.enabled} id={personalizationPanelId}>
                <div className="flex flex-col gap-3">
                  <Field
                    label="Recargo de nombre y número (₡)"
                    hint={
                      customOverridden
                        ? `Estándar: ${formatCRC(data.standard.personalization)}`
                        : 'Es el recargo estándar de la tienda'
                    }
                  >
                    <NumberInput value={customSurcharge} onChange={setCustomSurcharge} />
                  </Field>
                  <CheckList
                    legend="Competiciones disponibles para el nombre y número"
                    items={competitionItems}
                    selected={p.competitionIds}
                    onToggle={(id) => set({ competitionIds: toggle(p.competitionIds, id) })}
                    empty="Aún no hay competiciones: créalas en Predeterminados › Competiciones."
                  />
                </div>
              </Collapsible>
            </CollapsibleCard>
          </>
        )}

        <Notice notice={notice} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !p.name.trim()} className={btnPrimary}>
            {busy ? 'Guardando…' : 'Guardar camisa'}
          </button>
          <button type="button" onClick={onDone} className={btnSecondary}>
            Cancelar
          </button>
        </div>
      </form>

      <Modal open={patchModal} onClose={() => setPatchModal(false)} title="Nuevo grupo de parches">
        <PatchGroupEditor
          count={nextOrder(patchGroups)}
          onSaved={handlePatchGroupSaved}
          onCancel={() => setPatchModal(false)}
        />
      </Modal>
    </>
  )
}
