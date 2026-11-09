import { useCallback, useId, useState } from 'react'
import { MdAdd, MdClose } from 'react-icons/md'
import CheckList from '../../../components/CheckList.jsx'
import CollapsibleCard from '../../../components/CollapsibleCard.jsx'
import Field from '../../../components/Field.jsx'
import Modal from '../../../components/Modal.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { createSection, createTags, saveProduct } from '../../../services/catalog.js'
import { getDocData, listCollection } from '../../../services/db.js'
import { SIZES } from '../../../utils/constants.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, slugify } from '../../../utils/format.js'
import { nextOrder } from '../../../utils/tree.js'
import { btnPrimary, btnSecondary, inputClass } from '../../../utils/ui.js'
import { sectionPath } from '../../catalog/search.js'
import ImagesEditor from './ImagesEditor.jsx'
import PatchGroupEditor from './PatchGroupEditor.jsx'
import SectionSelector from './SectionSelector.jsx'
import SizeSurchargesEditor from './SizeSurchargesEditor.jsx'
import VariantEditor from './VariantEditor.jsx'
import VisibleSizesEditor from './VisibleSizesEditor.jsx'
import { filterPatchGroups, RECENT_LIMIT } from './patchFilter.js'
import { makeVariantId, validateSizes, validateVariants } from './productAdmin.js'

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
  competitionIds: [],
  sizeSurcharges: {},
  personalization: { enabled: false },
  visible: true,
}

async function loadOptions() {
  const [sections, tags, patchGroups, competitions, standard, sizeCharts] = await Promise.all([
    listCollection('sections'),
    listCollection('tags'),
    listCollection('patchGroups'),
    listCollection('competitions').catch(() => []),
    getDocData('settings', 'sizeSurcharges').catch(() => null),
    listCollection('sizeCharts').catch(() => []),
  ])
  return {
    sections,
    tags,
    patchGroups,
    competitions,
    standard: { sizes: standard?.values ?? {}, personalization: standard?.personalization ?? 0 },
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

/** Formulario de creación y edición de camisa. `productId` vacío = nueva. */
export default function ProductForm({ productId, onDone }) {
  const load = useCallback(async () => {
    const options = await loadOptions()
    if (!productId) return { ...options, product: { ...EMPTY }, cost: 0, variantCosts: {} }
    const [product, priv] = await Promise.all([
      getDocData('products', productId),
      getDocData('productPrivate', productId),
    ])
    return {
      ...options,
      product: { ...EMPTY, ...product },
      cost: priv?.cost ?? 0,
      variantCosts: priv?.variantCosts ?? {},
    }
  }, [productId])
  const { data, loading, error, reload } = useAsync(load)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return <FormBody key={productId ?? 'new'} data={data} onDone={onDone} />
}

function FormBody({ data, onDone }) {
  const [p, setP] = useState(data.product)
  const [cost, setCost] = useState(data.cost)
  const [variantCosts, setVariantCosts] = useState(data.variantCosts ?? {})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const [sections, setSections] = useState(data.sections)
  const [pick, setPick] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const sectionPanelId = useId()

  // Hashtags: los existentes más los escritos aquí (`pendingIds`), que se crean al guardar.
  const [tags, setTags] = useState(data.tags)
  const [pendingIds, setPendingIds] = useState([])
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
  const typedQuery = slugify(tagText.replace(/#/g, ''))
  const suggestions = tags
    .filter((t) => !p.tagIds.includes(t.id) && (!typedQuery || t.id.includes(typedQuery)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, 12)

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
  function handleAddVariant() {
    const id = makeVariantId()
    const newVariant = {
      id,
      name: '',
      visible: true,
    }
    set({ variants: [...(p.variants ?? []), newVariant] })
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
      await saveProduct(p, cost, variantCosts)
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
  const visibleSizes = p.sizes?.length ? p.sizes : SIZES

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h2 className="sr-only">{p.id ? 'Editar camisa' : 'Nueva camisa'}</h2>
        <input
          required
          aria-label="Nombre de la camisa"
          value={p.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={p.id ? 'Nombre de la camisa' : 'Nueva camisa: escribe el nombre'}
          maxLength={150}
          className={`${inputClass} !min-h-14 text-xl font-bold`}
        />

        <CollapsibleCard title="Descripción, precio e imágenes">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-3 md:col-span-3">
              <Field
                label="Nombre de la versión base"
                hint="Opcional. Si lo dejas vacío se mostrará como «Estándar»."
              >
                <input
                  value={p.baseVariantName ?? ''}
                  onChange={(e) => set({ baseVariantName: e.target.value })}
                  placeholder="Estándar"
                  maxLength={60}
                  className={inputClass}
                />
              </Field>

              <Field label="Descripción">
                <textarea
                  value={p.description}
                  onChange={(e) => set({ description: e.target.value })}
                  rows={5}
                  maxLength={2000}
                  className={`${inputClass} py-2`}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Precio base (₡)">
                  <NumberInput required value={p.price} onChange={(price) => set({ price })} />
                </Field>
                <Field
                  label={
                    <>
                      Costo del proveedor (₡){' '}
                      <span className="font-normal text-muted">· Privado</span>
                    </>
                  }
                >
                  <NumberInput value={cost} onChange={setCost} />
                </Field>
                <Field label="Margen estimado" hint="Precio menos costo">
                  <div className="flex h-11 items-center px-3 font-bold text-accent">
                    {formatCRC(p.price - cost)}
                  </div>
                </Field>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:col-span-1">
              <ImagesEditor
                images={p.images}
                onChange={(images) => set({ images })}
                label="Imágenes"
                hint="La primera es la portada."
              />
            </div>
          </div>
        </CollapsibleCard>

        {/* Versiones */}
        <CollapsibleCard
          title={`Versiones (${p.variants?.length ?? 0})`}
          actions={
            <button type="button" onClick={handleAddVariant} className={btnSecondary}>
              <MdAdd className="size-5" aria-hidden="true" />
              Agregar versión
            </button>
          }
        >
          <p className="text-sm text-muted">
            Agrega versiones para ofrecer variantes de esta camisa (ej. Hombre, Mujer, Niño, Manga
            Larga) con sus propios precios, fotos, tallas, tabla de tallas o recargos.
          </p>
          {p.variants?.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {p.variants.map((v, i) => (
                <VariantEditor
                  key={v.id}
                  variant={v}
                  index={i}
                  total={p.variants.length}
                  baseProduct={p}
                  baseCost={cost}
                  variantCost={variantCosts[v.id]}
                  sizeCharts={data.sizeCharts}
                  patchGroups={patchGroups}
                  standardSurcharges={data.standard}
                  onChange={(updated) => handleUpdateVariant(i, updated)}
                  onCostChange={(c) => handleUpdateVariantCost(v.id, c)}
                  onMove={handleMoveVariant}
                  onRemove={() => handleRemoveVariant(i, v.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Aún no hay versiones adicionales. La camisa se venderá con su versión base.
            </p>
          )}
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
              {pickParent ? `Nueva subsección en «${pickParent.name}»` : 'Nueva sección principal'}
            </button>
          }
        >
          {p.sectionIds.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted">Aún no has elegido ninguna sección.</p>
          )}
          <SectionSelector
            sections={sections}
            value={pick}
            onChange={setPick}
            onCreate={handleCreateSection}
            creating={creatingSection}
            createPanelId={sectionPanelId}
          />
          <button
            type="button"
            disabled={!pick || p.sectionIds.includes(pick)}
            onClick={() => {
              set({ sectionIds: [...p.sectionIds, pick] })
              setPick('')
            }}
            className={`${btnSecondary} self-start`}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            {pick ? `Agregar «${sectionLabel(pick)}» a la camisa` : 'Agregar sección a la camisa'}
          </button>
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
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {typedQuery ? 'Hashtags que coinciden' : 'Hashtags existentes'}
              </span>
              <ul className="flex flex-wrap gap-2">
                {suggestions.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => addTagIds([t.id])}
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
                <option value="elegidos">Elegidos en esta camisa ({p.patchGroupIds.length})</option>
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
          {patchMode === 'recientes' && !patchQuery.trim() && patchGroups.length > RECENT_LIMIT && (
            <p className="text-sm text-muted">
              Se muestran los últimos {RECENT_LIMIT} de {patchGroups.length}. Usa el buscador o
              «Todos» para ver el resto.
            </p>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Tallas y recargos">
          <VisibleSizesEditor
            value={p.sizes}
            onChange={(sizes) => set({ sizes })}
            label="Tallas visibles de la versión base"
          />

          <hr className="my-2 border-border" />

          <p className="text-sm text-muted">
            Recargos por talla. Parten de los recargos estándar de la tienda (menú Recargos).
            Cámbialos aquí solo si esta camisa es distinta.
          </p>
          <SizeSurchargesEditor
            sizes={visibleSizes}
            surcharges={p.sizeSurcharges}
            standardSizes={data.standard.sizes}
            onChange={(sizeSurcharges) => set({ sizeSurcharges })}
          />

          <div className="mt-3">
            <Field
              label="Nombre y número (₡)"
              hint={
                customOverridden
                  ? `Estándar: ${formatCRC(data.standard.personalization)}`
                  : 'Solo se cobra si permite personalizar'
              }
            >
              <NumberInput value={customSurcharge} onChange={setCustomSurcharge} />
            </Field>
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Personalización">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={p.personalization.enabled}
              onChange={(e) =>
                set({ personalization: { ...p.personalization, enabled: e.target.checked } })
              }
              className="size-4 accent-[var(--accent-solid)]"
            />
            Permite personalizar (nombre y número)
          </label>
          {p.personalization.enabled && (
            <CheckList
              legend="Competiciones disponibles para el nombre y número"
              items={competitionItems}
              selected={p.competitionIds}
              onToggle={(id) => set({ competitionIds: toggle(p.competitionIds, id) })}
              empty="Aún no hay competiciones: créalas en el menú Competiciones."
            />
          )}
        </CollapsibleCard>

        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={p.visible}
            onChange={(e) => set({ visible: e.target.checked })}
            className="size-4 accent-[var(--accent-solid)]"
          />
          Visible para los clientes
        </label>

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
