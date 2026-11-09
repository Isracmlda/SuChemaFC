import { useState } from 'react'
import {
  MdArrowDownward,
  MdArrowUpward,
  MdDelete,
  MdExpandLess,
  MdExpandMore,
} from 'react-icons/md'
import CheckList from '../../../components/CheckList.jsx'
import Field from '../../../components/Field.jsx'
import NumberInput from '../../../components/NumberInput.jsx'
import { SIZES } from '../../../utils/constants.js'
import { formatCRC } from '../../../utils/format.js'
import { btnIcon, cardClass, inputClass } from '../../../utils/ui.js'
import { chartSizes } from '../../sizeChart/chart.js'
import ImagesEditor from './ImagesEditor.jsx'
import SizeSurchargesEditor from './SizeSurchargesEditor.jsx'
import VisibleSizesEditor from './VisibleSizesEditor.jsx'

/**
 * Editor de una versión individual de la camisa.
 */
export default function VariantEditor({
  variant,
  index,
  total,
  baseProduct,
  baseCost = 0,
  variantCost,
  sizeCharts = [],
  patchGroups = [],
  standardSurcharges = {},
  onChange,
  onCostChange,
  onMove,
  onRemove,
}) {
  const [expanded, setExpanded] = useState(true)

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

  const hasCustomImages = Array.isArray(variant.images)
  const hasCustomPatches = Array.isArray(variant.patchGroupIds)
  const hasCustomPersonalization = variant.personalization != null

  const patchItems = patchGroups.map((g) => ({ id: g.id, label: g.name }))

  function set(patch) {
    onChange({ ...variant, ...patch })
  }

  function toggle(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  return (
    <li className={`${cardClass} flex flex-col gap-3 border border-border`}>
      {/* Cabecera de la versión */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex items-center gap-1 font-bold text-base hover:text-accent"
          >
            {expanded ? <MdExpandLess className="size-5" /> : <MdExpandMore className="size-5" />}
            <span>{variant.name || `Versión ${index + 1}`}</span>
          </button>
          {!variant.visible && (
            <span className="rounded bg-muted/20 px-2 py-0.5 text-xs text-muted font-normal">
              Oculta
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Mover versión ${variant.name} hacia arriba`}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className={btnIcon}
          >
            <MdArrowUpward className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Mover versión ${variant.name} hacia abajo`}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className={btnIcon}
          >
            <MdArrowDownward className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Eliminar versión ${variant.name}`}
            onClick={onRemove}
            className={`${btnIcon} text-error hover:bg-error/10`}
          >
            <MdDelete className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 pt-1">
          {/* Nombre y visibilidad */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre de la versión" required className="sm:col-span-2">
              <input
                required
                value={variant.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Ej. Hombre, Mujer, Niño, Manga Larga..."
                maxLength={100}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={variant.visible !== false}
                  onChange={(e) => set({ visible: e.target.checked })}
                  className="size-4 accent-[var(--accent-solid)]"
                />
                Visible para clientes
              </label>
            </div>
          </div>

          {/* Precio, Costo y Margen */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Precio de esta versión (₡)"
              hint={
                variant.price != null && variant.price !== ''
                  ? `Base: ${formatCRC(baseProduct.price)}`
                  : `Hereda precio base: ${formatCRC(baseProduct.price)}`
              }
            >
              <NumberInput
                value={variant.price ?? ''}
                onChange={(p) => set({ price: p === '' ? undefined : p })}
              />
            </Field>
            <Field
              label="Costo de proveedor (₡)"
              hint={
                variantCost != null && variantCost !== ''
                  ? `Base: ${formatCRC(baseCost)}`
                  : `Hereda costo base: ${formatCRC(baseCost)}`
              }
            >
              <NumberInput
                value={variantCost ?? ''}
                onChange={(c) => onCostChange(c === '' ? undefined : c)}
              />
            </Field>
          </div>

          {/* Guía de tallas */}
          <Field
            label="Guía de tallas"
            hint="La guía que verá el cliente al abrir «Guía de tallas» con esta versión. Sus tallas son las que puedes ofrecer."
          >
            <select
              value={variant.sizeChartId ?? ''}
              // Las tallas pertenecen a la guía: al cambiarla se vuelven a elegir.
              onChange={(e) => set({ sizeChartId: e.target.value || undefined, sizes: undefined })}
              className={inputClass}
            >
              <option value="">
                {baseChart
                  ? `(Usa la de la camisa base: ${baseChart.name})`
                  : '(Sin guía de tallas)'}
              </option>
              {sizeCharts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Tallas visibles */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <VisibleSizesEditor
              value={variant.sizes}
              onChange={(sizes) => set({ sizes })}
              inheritedSizes={baseSizes}
              allowInherit={true}
              label="Tallas visibles para esta versión"
              chart={chart}
            />
          </div>

          {/* Recargos por talla */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <span className="text-sm font-semibold mb-2 block">
              Recargos por talla de esta versión
            </span>
            <p className="text-xs text-muted mb-3">
              Por defecto usa los recargos de la camisa base. Modifica solo los que cambien.
            </p>
            <SizeSurchargesEditor
              sizes={variantSizes}
              surcharges={variant.sizeSurcharges ?? {}}
              standardSizes={baseProduct.sizeSurcharges ?? standardSurcharges.sizes ?? {}}
              onChange={(sizeSurcharges) =>
                set({
                  sizeSurcharges:
                    Object.keys(sizeSurcharges).length > 0 ? sizeSurcharges : undefined,
                })
              }
              resetLabel="Usar recargos de la camisa"
            />
          </div>

          {/* Fotos de la versión */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Fotos de esta versión</span>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hasCustomImages}
                  onChange={(e) => set({ images: e.target.checked ? [] : undefined })}
                  className="accent-[var(--accent-solid)]"
                />
                Fotos propias para esta versión
              </label>
            </div>
            {hasCustomImages ? (
              <ImagesEditor
                images={variant.images ?? []}
                onChange={(images) => set({ images })}
                label=""
                hint="Estas fotos se mostrarán cuando el cliente elija esta versión."
              />
            ) : (
              <p className="text-xs text-muted">
                Usa las fotos de la camisa base ({baseProduct.images?.length ?? 0} fotos).
              </p>
            )}
          </div>

          {/* Parches */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Grupos de parches</span>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hasCustomPatches}
                  onChange={(e) =>
                    set({
                      patchGroupIds: e.target.checked
                        ? [...(baseProduct.patchGroupIds ?? [])]
                        : undefined,
                    })
                  }
                  className="accent-[var(--accent-solid)]"
                />
                Parches propios para esta versión
              </label>
            </div>
            {hasCustomPatches ? (
              <CheckList
                legend="Parches aplicables a esta versión"
                items={patchItems}
                selected={variant.patchGroupIds ?? []}
                onToggle={(id) => set({ patchGroupIds: toggle(variant.patchGroupIds ?? [], id) })}
                empty="No hay grupos de parches disponibles."
              />
            ) : (
              <p className="text-xs text-muted">
                Usa los parches de la camisa base ({baseProduct.patchGroupIds?.length ?? 0} grupos).
              </p>
            )}
          </div>

          {/* Personalización */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Personalización (nombre y número)</span>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hasCustomPersonalization}
                  onChange={(e) =>
                    set({
                      personalization: e.target.checked
                        ? { enabled: Boolean(baseProduct.personalization?.enabled) }
                        : undefined,
                    })
                  }
                  className="accent-[var(--accent-solid)]"
                />
                Personalización propia para esta versión
              </label>
            </div>
            {hasCustomPersonalization ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={Boolean(variant.personalization?.enabled)}
                    onChange={(e) =>
                      set({
                        personalization: {
                          ...variant.personalization,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-[var(--accent-solid)]"
                  />
                  Permite personalizar esta versión
                </label>
                {variant.personalization?.enabled && (
                  <Field
                    label="Recargo de personalización para esta versión (₡)"
                    hint={`Base: ${formatCRC(
                      baseProduct.personalization?.surcharge ??
                        standardSurcharges.personalization ??
                        0,
                    )}`}
                  >
                    <NumberInput
                      value={variant.personalization?.surcharge ?? ''}
                      onChange={(surcharge) =>
                        set({
                          personalization: {
                            ...variant.personalization,
                            surcharge: surcharge === '' ? undefined : surcharge,
                          },
                        })
                      }
                    />
                  </Field>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Usa la configuración de la camisa base (
                {baseProduct.personalization?.enabled ? 'Permite personalizar' : 'No permite'}
                ).
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
