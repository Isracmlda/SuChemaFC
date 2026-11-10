import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { useState } from 'react'
import { reorderSections } from '../../services/catalog.js'
import { clearCatalogCache } from '../../services/storefront.js'
import { errorMessage } from '../../utils/errors.js'

const chipClass =
  'inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-border-strong px-3 text-sm font-semibold hover:border-accent hover:text-accent sm:min-h-11 sm:px-4'

function SortableChip({ section, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`shrink-0 snap-start ${isDragging ? 'relative z-20 opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen(section.id)}
        title="Arrastra para cambiar el orden"
        // Arrastrar con el mouse, el dedo (mantener presionado) o el teclado (Espacio y flechas).
        {...attributes}
        {...listeners}
        className={`${chipClass} ${isDragging ? 'cursor-grabbing border-accent text-accent' : 'cursor-grab'} touch-manipulation`}
      >
        {section.name}
      </button>
    </li>
  )
}

/**
 * Chips de subcategorías que el admin puede reacomodar arrastrando (mouse, táctil o teclado).
 * `items` son hermanas ordenadas; al soltar se guarda el nuevo orden y se llama a `onChanged`.
 * Un toque o clic normal sigue abriendo la sección (`onOpen`).
 */
export default function SortableSections({ items, onOpen, onChanged, onError }) {
  const [order, setOrder] = useState(null) // ids en el orden mostrado mientras se guarda
  const [busy, setBusy] = useState(false)

  const sensors = useSensors(
    // Un clic sin mover no arrastra: hace falta mover 6 px.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // En táctil se mantiene presionado un instante, para no confundir con el desplazamiento.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const shown = order ? order.map((id) => items.find((s) => s.id === id)).filter(Boolean) : items

  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const ids = shown.map((s) => s.id)
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))
    const ordered = next.map((id) => items.find((s) => s.id === id))
    setOrder(next)
    setBusy(true)
    try {
      await reorderSections(ordered, items.find((s) => s.id === active.id)?.name)
      clearCatalogCache()
      await onChanged()
    } catch (e) {
      onError?.(errorMessage(e))
    } finally {
      setOrder(null)
      setBusy(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={shown.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
        {shown.map((s) => (
          <SortableChip key={s.id} section={s} onOpen={onOpen} disabled={busy} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
