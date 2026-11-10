import { MdDelete } from 'react-icons/md'
import CheckList from '../../../components/CheckList.jsx'
import Field from '../../../components/Field.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { SIZES } from '../../../utils/constants.js'
import { formatCRC } from '../../../utils/format.js'
import { btnDanger, inputClass } from '../../../utils/ui.js'
import { chartSizes } from '../../sizeChart/chart.js'
import ImagesEditor from './ImagesEditor.jsx'
import SizeSurchargesEditor from './SizeSurchargesEditor.jsx'
import VisibleSizesEditor from './VisibleSizesEditor.jsx'

/**
 * Sección de una versión con un check «Usar la de la versión base»: marcado muestra solo el dato
 * heredado (`note`); desmarcado muestra los campos propios (`children`).
 */
function Inheritable({ title, inherited, onToggle, note, disabled = false, children }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={inherited}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-[var(--accent-solid)]"
          />
          Usar la de la versión base
        </label>
      </div>
      {inherited ? <p className="text-xs text-muted">{note}</p> : children}
    </div>
  )
}

/**
 * Editor de la versión elegida en el selector. Lo que no se personaliza (check marcado) se hereda
 * de la versión base.
 */
export default function VariantEditor({
  variant,
  baseProduct,
  baseCost = 0,
  variantCost,
  sizeCharts = [],
  patchGroups = [],
  standardSurcharges = {},
  onChange,
  onCostChange,
  onRemove,
}) {
  const baseSizes = baseProduct.sizes?.length ? baseProduct.sizes : SIZES
  // Guía de la versión: la propia o, si no tiene, la de la camisa base.
  const baseChart = sizeCharts.find((c) => c.id === baseProduct.sizeChartId) ?? null
  const chart = sizeCharts.find((c) => c.id === variant.sizeChartId) ?? baseChart
  const chartAll = chartSizes(chart)
  const chartPicked = variant.sizes?.filter((s) => chartAll.includes(s)) ?? []
  const variantSizes = chart
    ? chartPicked.length > 0
      ? chartAll.filter((s) => chartPicked.includes(s))
      : chartAll
    : variant.sizes?.length
      ? variant.sizes
      : baseSizes

  const ownPrice = variant.price != null && variant.price !== ''
  const ownCost = variantCost != null && variantCost !== ''
  const hasOwnImages = Array.isArray(variant.images)
  const hasOwnPatches = Array.isArray(variant.patchGroupIds)
  const hasOwnPersonalization = variant.personalization != null
  const hasOwnChart = Boolean(variant.sizeChartId)
  const hasOwnSurcharges = variant.sizeSurcharges != null

  const patchItems = patchGroups.map((g) => ({ id: g.id, label: g.name }))

  function set(patch) {
    onChange({ ...variant, ...patch })
  }

  function toggle(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Nombre, visibilidad y eliminar */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Nombre de la versión" required>
          <input
            required
            value={variant.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ej. Hombre, Mujer, Niño, Manga Larga..."
            maxLength={100}
            className={inputClass}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={variant.visible !== false}
            onChange={(e) => set({ visible: e.target.checked })}
            className="size-4 accent-[var(--accent-solid)]"
          />
          Visible para clientes
        </label>
        <button type="button" onClick={onRemove} className={btnDanger}>
          <MdDelete className="size-5" aria-hidden="true" />
          Eliminar versión
        </button>
      </div>

      {/* Precio y costo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Inheritable
          title="Precio de esta versión (₡)"
          inherited={!ownPrice}
          onToggle={(use) => set({ price: use ? undefined : baseProduct.price })}
          note={`Usa el precio de la versión base: ${formatCRC(baseProduct.price)}`}
        >
          <NumberInput value={variant.price ?? ''} onChange={(price) => set({ price })} />
        </Inheritable>
        <Inheritable
          title="Costo del proveedor (₡)"
          inherited={!ownCost}
          onToggle={(use) => onCostChange(use ? undefined : baseCost)}
          note={`Usa el costo de la versión base: ${formatCRC(baseCost)}`}
        >
          <NumberInput value={variantCost ?? ''} onChange={onCostChange} />
        </Inheritable>
      </div>

      {/* Fotos */}
      <Inheritable
        title="Fotos de esta versión"
        inherited={!hasOwnImages}
        onToggle={(use) => set({ images: use ? undefined : [] })}
        note={`Usa las fotos de la versión base (${baseProduct.images?.length ?? 0} fotos).`}
      >
        <ImagesEditor
          images={variant.images ?? []}
          onChange={(images) => set({ images })}
          label=""
          hint="Estas fotos se mostrarán cuando el cliente elija esta versión."
        />
      </Inheritable>

      {/* Guía de tallas */}
      <Inheritable
        title="Guía de tallas"
        inherited={!hasOwnChart}
        disabled={sizeCharts.length === 0}
        // Las tallas pertenecen a la guía: al cambiarla se vuelven a elegir.
        onToggle={(use) =>
          set({ sizeChartId: use ? undefined : (sizeCharts[0]?.id ?? undefined), sizes: undefined })
        }
        note={
          baseChart
            ? `Usa la guía de la versión base: ${baseChart.name}`
            : 'La versión base no tiene guía de tallas.'
        }
      >
        <select
          aria-label="Guía de tallas de esta versión"
          value={variant.sizeChartId ?? ''}
          onChange={(e) => set({ sizeChartId: e.target.value || undefined, sizes: undefined })}
          className={inputClass}
        >
          {sizeCharts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          La guía que verá el cliente al abrir «Guía de tallas» con esta versión. Sus tallas son las
          que puedes ofrecer.
        </p>
      </Inheritable>

      {/* Tallas visibles */}
      <div className="rounded-md border border-border bg-surface-2 p-3">
        <VisibleSizesEditor
          value={variant.sizes}
          onChange={(sizes) => set({ sizes })}
          inheritedSizes={baseSizes}
          label="Tallas visibles para esta versión"
          chart={chart}
        />
      </div>

      {/* Recargos por talla */}
      <Inheritable
        title="Recargos por talla"
        inherited={!hasOwnSurcharges}
        onToggle={(use) => set({ sizeSurcharges: use ? undefined : {} })}
        note="Usa los recargos de la versión base."
      >
        <SizeSurchargesEditor
          sizes={variantSizes}
          surcharges={variant.sizeSurcharges ?? {}}
          standardSizes={{ ...standardSurcharges.sizes, ...baseProduct.sizeSurcharges }}
          onChange={(sizeSurcharges) => set({ sizeSurcharges })}
          resetLabel="Usar los recargos de la versión base"
        />
      </Inheritable>

      {/* Parches */}
      <Inheritable
        title="Grupos de parches"
        inherited={!hasOwnPatches}
        onToggle={(use) =>
          set({ patchGroupIds: use ? undefined : [...(baseProduct.patchGroupIds ?? [])] })
        }
        note={`Usa los parches de la versión base (${baseProduct.patchGroupIds?.length ?? 0} grupos).`}
      >
        <CheckList
          legend="Parches aplicables a esta versión"
          items={patchItems}
          selected={variant.patchGroupIds ?? []}
          onToggle={(id) => set({ patchGroupIds: toggle(variant.patchGroupIds ?? [], id) })}
          empty="No hay grupos de parches disponibles."
        />
      </Inheritable>

      {/* Personalización */}
      <Inheritable
        title="Personalización (nombre y número)"
        inherited={!hasOwnPersonalization}
        onToggle={(use) =>
          set({
            personalization: use
              ? undefined
              : { enabled: Boolean(baseProduct.personalization?.enabled) },
          })
        }
        note={`Usa la configuración de la versión base (${
          baseProduct.personalization?.enabled ? 'permite personalizar' : 'no permite personalizar'
        }).`}
      >
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={Boolean(variant.personalization?.enabled)}
              onChange={(e) =>
                set({ personalization: { ...variant.personalization, enabled: e.target.checked } })
              }
              className="size-4 accent-[var(--accent-solid)]"
            />
            Permite personalizar esta versión
          </label>
          {variant.personalization?.enabled && (
            <Field
              label="Recargo de personalización para esta versión (₡)"
              hint={`Base: ${formatCRC(
                baseProduct.personalization?.surcharge ?? standardSurcharges.personalization ?? 0,
              )}`}
            >
              <NumberInput
                value={variant.personalization?.surcharge ?? ''}
                onChange={(surcharge) =>
                  set({ personalization: { ...variant.personalization, surcharge } })
                }
              />
            </Field>
          )}
        </div>
      </Inheritable>
    </div>
  )
}
