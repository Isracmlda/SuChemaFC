import { useState } from 'react'
import { MdAdd, MdDelete, MdEdit } from 'react-icons/md'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import { deletePatchGroup } from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { formatCRC } from '../../../utils/format.js'
import { nextOrder } from '../../../utils/tree.js'
import { btnIcon, btnPrimary, cardClass } from '../../../utils/ui.js'
import PatchGroupEditor from './PatchGroupEditor.jsx'

const loadGroups = () => listCollection('patchGroups')

export default function PatchGroupsPage() {
  const dialog = useDialog()
  const { data, loading, error, reload } = useAsync(loadGroups)
  const [form, setForm] = useState(null) // null = cerrado
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const groups = [...data].sort((a, b) => a.order - b.order)

  async function handleDelete(group) {
    const sure = await dialog.confirm({
      title: 'Eliminar grupo',
      message: `¿Eliminar el grupo "${group.name}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!sure) return
    setBusy(true)
    setNotice(null)
    try {
      await deletePatchGroup(group)
      setNotice({ type: 'ok', text: 'Grupo eliminado.' })
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  if (form) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">
          {form.id ? 'Editar grupo de parches' : 'Nuevo grupo de parches'}
        </h2>
        <PatchGroupEditor
          initial={form.id ? form : undefined}
          count={nextOrder(groups)}
          onSaved={() => {
            setNotice({ type: 'ok', text: 'Grupo guardado.' })
            setForm(null)
            reload()
          }}
          onCancel={() => setForm(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Los grupos nuevos se crean directamente desde el formulario de la camisa. Aquí puedes
        editarlos o eliminarlos.
      </p>
      <button
        type="button"
        onClick={() => {
          setNotice(null)
          setForm({})
        }}
        className={`${btnPrimary} self-start`}
      >
        <MdAdd className="size-5" aria-hidden="true" />
        Nuevo grupo
      </button>
      <Notice notice={notice} />
      {groups.length === 0 ? (
        <EmptyState>Aún no hay grupos de parches.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-muted">
                  {g.options.length} opción(es)
                  {g.options.length > 0 &&
                    `: ${g.options.map((o) => `${o.name} (${formatCRC(o.price)})`).join(', ')}`}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Editar ${g.name}`}
                title="Editar"
                onClick={() => {
                  setNotice(null)
                  setForm(g)
                }}
                className={btnIcon}
              >
                <MdEdit className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${g.name}`}
                title="Eliminar"
                disabled={busy}
                onClick={() => handleDelete(g)}
                className={btnIcon}
              >
                <MdDelete className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
