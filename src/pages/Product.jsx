import { useCallback, useState } from 'react'
import { MdCheck, MdFavorite, MdFavoriteBorder, MdShare } from 'react-icons/md'
import { Link, useParams } from 'react-router-dom'
import DriveImage from '../components/DriveImage.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { effectivePrice, isSaleActive } from '../features/catalog/search.js'
import {
  blankShirt,
  buildShirtLines,
  changeShirtVariant,
  shirtChipLabel,
  shirtView,
  summarizeShirts,
} from '../features/catalog/shirts.js'
import {
  DEFAULT_BASE_VARIANT_NAME,
  hasVariants,
  visibleVariants,
} from '../features/catalog/variants.js'
import { enabledOptions } from '../features/catalog/patches.js'
import ReviewsSection from '../features/reviews/ReviewsSection.jsx'
import PersonalizationEditor from '../features/personalization/PersonalizationEditor.jsx'
import { buildProductMeta, productUrl } from '../features/seo/seo.js'
import { personalizationSurcharge, sizeSurcharge } from '../features/pricing/price.js'
import SaleCountdown from '../features/pricing/SaleCountdown.jsx'
import SizeGuide from '../features/sizeChart/SizeGuide.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useCart } from '../hooks/useCart.js'
import { useDialog } from '../hooks/useDialog.js'
import { useToast } from '../hooks/useToast.js'
import { loadProduct } from '../services/storefront.js'
import { formatCRC } from '../utils/format.js'
import { btnPrimary, btnSecondary, cardClass } from '../utils/ui.js'

const ZOOM = 2

/** Imagen principal con zoom al pasar el mouse; sigue al puntero. En pantallas táctiles no aplica. */
function ZoomImage({ id, name }) {
  const [zoom, setZoom] = useState(null) // { x, y } en % o null

  function track(e) {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    setZoom({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    })
  }

  return (
    <div
      onPointerEnter={track}
      onPointerMove={track}
      onPointerLeave={() => setZoom(null)}
      className={`aspect-square flex-1 overflow-hidden rounded-lg ${zoom ? 'cursor-zoom-in' : ''}`}
    >
      <div
        className="size-full"
        style={
          zoom
            ? { transform: `scale(${ZOOM})`, transformOrigin: `${zoom.x}% ${zoom.y}%` }
            : undefined
        }
      >
        <DriveImage id={id} size={1200} alt={name} className="size-full" />
      </div>
    </div>
  )
}

function Gallery({ images, name }) {
  const [index, setIndex] = useState(0)
  const current = images[index] ?? images[0]
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <ZoomImage id={current} name={name} />
      {images.length > 1 && (
        <ul
          className="flex gap-2 overflow-x-auto md:order-first md:flex-col md:overflow-x-visible"
          aria-label="Imágenes de la camisa"
        >
          {images.map((id, i) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === index}
                className={`block overflow-hidden rounded-md border-2 ${i === index ? 'border-accent' : 'border-border'}`}
              >
                <DriveImage id={id} size={160} className="size-16" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ShareButton({ id }) {
  const [copied, setCopied] = useState(false)
  const dialog = useDialog()
  const toast = useToast()

  async function copy() {
    const url = productUrl(window.location.origin, id)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      await dialog.showText({ title: 'Copiar enlace', message: 'Copia este enlace:', text: url })
      return
    }
    toast.ok('Enlace copiado.')
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button type="button" onClick={copy} className={`${btnSecondary} self-start`}>
      {copied ? (
        <MdCheck className="size-5" aria-hidden="true" />
      ) : (
        <MdShare className="size-5" aria-hidden="true" />
      )}
      <span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
    </button>
  )
}

/**
 * Miniatura de la opción de un parche. Al pasar el mouse abre una vista ampliada con el nombre,
 * encima de la miniatura. En pantallas táctiles no aplica.
 */
function PatchThumb({ image, name }) {
  const [open, setOpen] = useState(false)
  const show = (e) => e.pointerType === 'mouse' && setOpen(true)
  return (
    <span onPointerEnter={show} onPointerLeave={() => setOpen(false)} className="relative shrink-0">
      <DriveImage id={image} size={96} className="size-8 rounded" />
      {open && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 z-30 mb-3 w-56 rounded-lg border border-border-strong bg-surface p-3 text-center text-sm font-normal text-fg shadow-lg"
        >
          <DriveImage id={image} size={400} className="aspect-square w-full rounded-md" />
          <span className="mt-2 block">{name}</span>
          <span className="absolute -bottom-1.5 left-3 size-3 rotate-45 border-b border-r border-border-strong bg-surface" />
        </span>
      )}
    </span>
  )
}

const chipClass = (selected) =>
  `min-h-11 rounded-md border px-4 text-sm font-semibold ${
    selected
      ? 'border-accent-solid bg-accent-solid text-on-accent'
      : 'border-border-strong hover:border-accent'
  }`

/**
 * Compra de una o varias camisas. El estado (`shirts`, `active`) vive en la página porque la galería,
 * el precio y la guía de tallas siguen a la versión de la camisa activa.
 */
function Purchase({
  product,
  shirts,
  setShirts,
  active,
  setActive,
  catalogGroups,
  competitions,
  standardSurcharges,
}) {
  const toast = useToast()
  const { addToCart, toggleWishlist, inWishlist } = useCart()

  const qty = shirts.length
  const cur = shirts[active] ?? shirts[0]
  const { patches, custom } = cur
  const summary = summarizeShirts(product, shirts, {
    catalogGroups,
    requireCompetition: competitions.length > 0,
    standard: standardSurcharges,
  })
  const { infos, unit, sameUnit, total, missingSize, canAdd } = summary
  const { view, groups: patchGroups, personalizable } = infos[active] ?? infos[0]
  const surcharge = (s) => sizeSurcharge(view, s, standardSurcharges)
  const liked = inWishlist(product.id)
  const versions = hasVariants(product)
    ? [
        { id: null, name: product.baseVariantName || DEFAULT_BASE_VARIANT_NAME },
        ...visibleVariants(product),
      ]
    : []

  const updateShirt = (patch) =>
    setShirts((prev) => prev.map((s, i) => (i === active ? { ...s, ...patch } : s)))
  const setPatches = (next) => updateShirt({ patches: next })
  const setCustom = (next) => updateShirt({ custom: next })
  const setSize = (size) => updateShirt({ size })
  const setVariant = (variantId) =>
    setShirts((prev) =>
      prev.map((s, i) => (i === active ? changeShirtVariant(s, product, variantId) : s)),
    )
  function setQty(n) {
    setShirts((prev) =>
      n <= prev.length
        ? prev.slice(0, n)
        : [...prev, ...Array.from({ length: n - prev.length }, blankShirt)],
    )
    setActive((a) => Math.min(a, n - 1))
  }

  function handleAdd() {
    const lines = buildShirtLines(product, shirts, infos)
    const ok = lines.map((line) => addToCart(line)).every(Boolean)
    if (ok) {
      toast.ok(`Agregaste ${qty} al carrito.`, { action: { to: '/carrito', label: 'Ver carrito' } })
    } else {
      toast.error('El carrito está lleno (máximo 50 líneas). Quita alguna para seguir.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {qty > 1 && (
        <fieldset>
          <legend className="mb-2 font-semibold">Configurar cada camisa</legend>
          <div className="flex flex-wrap gap-2">
            {shirts.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={chipClass(i === active)}
              >
                {shirtChipLabel(product, s, i)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {versions.length > 0 && (
        <fieldset>
          <legend className="mb-2 font-semibold">Versión</legend>
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => {
              const selected = (cur.variantId ?? null) === v.id
              return (
                <label
                  key={v.id ?? 'base'}
                  className={`inline-flex cursor-pointer items-center ${chipClass(selected)}`}
                >
                  <input
                    type="radio"
                    name={`variant-${active}`}
                    value={v.id ?? ''}
                    checked={selected}
                    onChange={() => setVariant(v.id)}
                    className="sr-only"
                  />
                  {v.name}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 font-semibold">Talla</legend>
        <div className="flex flex-wrap gap-2">
          {view.sizes.map((s) => (
            <label
              key={s}
              className={`inline-flex min-h-11 min-w-14 cursor-pointer flex-col items-center justify-center rounded-md border px-3 text-sm font-semibold ${
                cur.size === s
                  ? 'border-accent-solid bg-accent-solid text-on-accent'
                  : 'border-border-strong hover:border-accent'
              }`}
            >
              <input
                type="radio"
                name={`size-${active}`}
                value={s}
                checked={cur.size === s}
                onChange={() => setSize(s)}
                className="sr-only"
              />
              {s}
              {surcharge(s) > 0 && (
                <span className="text-[11px] font-normal">+{formatCRC(surcharge(s))}</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {patchGroups.map((group) => (
        <fieldset key={group.id}>
          <legend className="mb-2 font-semibold">{group.name}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm ${patches[group.id] == null ? 'border-accent font-semibold' : 'border-border-strong'}`}
            >
              <input
                type="radio"
                name={`patch-${group.id}`}
                checked={patches[group.id] == null}
                onChange={() => setPatches({ ...patches, [group.id]: null })}
                className="size-4 accent-[var(--accent-solid)]"
              />
              Sin parche
            </label>
            {enabledOptions(view, group).map(({ option: o, index: i }) => (
              <label
                key={i}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm ${patches[group.id] === i ? 'border-accent font-semibold' : 'border-border-strong'}`}
              >
                <input
                  type="radio"
                  name={`patch-${group.id}`}
                  checked={patches[group.id] === i}
                  onChange={() => setPatches({ ...patches, [group.id]: i })}
                  className="size-4 accent-[var(--accent-solid)]"
                />
                {o.image && <PatchThumb image={o.image} name={o.name} />}
                <span className="flex-1">{o.name}</span>
                <span className="text-muted">+{formatCRC(o.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {personalizable && (
        <PersonalizationEditor
          value={custom}
          surcharge={personalizationSurcharge(view, standardSurcharges)}
          onChange={setCustom}
          formatPrice={formatCRC}
          competitions={competitions}
        />
      )}

      <div className="flex items-center gap-3">
        <span className="font-semibold">Cantidad</span>
        <div className="inline-flex items-center rounded-md border border-border-strong">
          <button
            type="button"
            aria-label="Menos"
            disabled={qty <= 1}
            onClick={() => setQty(qty - 1)}
            className="size-11 text-lg font-bold disabled:opacity-40"
          >
            −
          </button>
          <output aria-live="polite" className="w-10 text-center font-semibold">
            {qty}
          </output>
          <button
            type="button"
            aria-label="Más"
            disabled={qty >= 10}
            onClick={() => setQty(qty + 1)}
            className="size-11 text-lg font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm text-muted">
            {sameUnit ? `Total (${qty} × ${formatCRC(unit)})` : `Total (${qty} camisas)`}
          </p>
          <p className="text-2xl font-extrabold" aria-live="polite">
            {formatCRC(total)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? 'Quitar de la lista de deseos' : 'Guardar en la lista de deseos'}
            title={liked ? 'Quitar de la lista de deseos' : 'Guardar en la lista de deseos'}
            onClick={() => toggleWishlist(product.id)}
            className={btnSecondary}
          >
            {liked ? (
              <MdFavorite className="size-5 text-accent" aria-hidden="true" />
            ) : (
              <MdFavoriteBorder className="size-5" aria-hidden="true" />
            )}
          </button>
          <button type="button" disabled={!canAdd} onClick={handleAdd} className={btnPrimary}>
            Agregar al carrito
          </button>
        </div>
      </div>
      {missingSize.length > 0 && (
        <p className="text-sm text-muted">
          {qty > 1
            ? `Falta elegir la talla de: ${missingSize.map((i) => `Camisa ${i + 1}`).join(', ')}.`
            : 'Elige una talla para continuar.'}
        </p>
      )}
    </div>
  )
}

export default function Product() {
  const { id } = useParams()
  const load = useCallback(() => loadProduct(id), [id])
  const { data, loading, error, reload } = useAsync(load)
  const found = data?.product
  usePageMeta(found?.name ?? '', found ? buildProductMeta(found, '').description : '')

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data.product) {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState>Esta camisa ya no está disponible.</EmptyState>
        <Link to="/" className={btnSecondary}>
          Volver al catálogo
        </Link>
      </div>
    )
  }

  return <ProductView key={data.product.id} product={data.product} catalog={data.catalog} />
}

function ProductView({ product, catalog }) {
  // Una entrada por camisa: versión, talla, parches y personalización son independientes en cada una.
  const [shirts, setShirts] = useState(() => [blankShirt()])
  const [active, setActive] = useState(0)

  // La galería, el precio y la guía de tallas siguen a la versión de la camisa activa.
  const view = shirtView(product, shirts[active] ?? shirts[0])
  const competitions = (product.competitionIds ?? [])
    .map((cid) => (catalog.competitions ?? []).find((c) => c.id === cid))
    .filter(Boolean)
  const tags = (product.tagIds ?? [])
    .map((tid) => catalog.tags.find((t) => t.id === tid))
    .filter(Boolean)
  const onSale = isSaleActive(view)
  const viewKey = view.variantId ?? 'base'

  return (
    <article className="flex flex-col gap-6">
      <Link to="/" className="self-start text-sm font-semibold text-accent underline">
        ← Volver al catálogo
      </Link>
      <div className="grid gap-6 md:grid-cols-2 md:grid-rows-[auto_1fr] md:items-start">
        <div className="md:col-start-1 md:row-start-1">
          <Gallery key={viewKey} images={view.images ?? []} name={product.name} />
        </div>
        <div className="flex flex-col gap-5 md:col-start-2 md:row-span-2 md:row-start-1">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-extrabold">{formatCRC(effectivePrice(view))}</span>
              {onSale && (
                <>
                  <s className="text-muted">
                    <span className="sr-only">Antes </span>
                    {formatCRC(view.price)}
                  </s>
                  <span className="rounded-md bg-accent-solid px-2 py-0.5 text-xs font-bold text-on-accent">
                    Oferta
                  </span>
                </>
              )}
            </p>
            {onSale && <SaleCountdown sale={view.sale} />}
          </header>
          {product.description && <p className="whitespace-pre-line">{product.description}</p>}
          {tags.length > 0 && (
            <ul className="-mt-2 flex flex-wrap gap-1.5" aria-label="Hashtags de la camisa">
              {tags.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/?hashtag=${encodeURIComponent(t.id)}`}
                    target="_blank"
                    rel="noopener"
                    title={`Ver todas las camisas con #${t.name}`}
                    className="inline-flex items-center rounded-full bg-accent-solid px-2 py-0.5 text-xs font-bold text-on-accent hover:opacity-85"
                  >
                    #{t.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton id={product.id} />
            <SizeGuide
              key={viewKey}
              chart={catalog.sizeCharts.find((c) => c.id === view.sizeChartId)}
            />
          </div>
          <Purchase
            product={product}
            shirts={shirts}
            setShirts={setShirts}
            active={active}
            setActive={setActive}
            catalogGroups={catalog.patchGroups}
            competitions={competitions}
            standardSurcharges={catalog.surcharges}
          />
        </div>
        <div className="md:col-start-1 md:row-start-2">
          <ReviewsSection productId={product.id} />
        </div>
      </div>
    </article>
  )
}
