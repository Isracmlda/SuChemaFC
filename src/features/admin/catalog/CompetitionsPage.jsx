import { useState } from 'react'
import { MdAdd, MdCheck, MdClose, MdDelete, MdEdit } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import { deleteCompetition, saveCompetition } from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { normalizeText } from '../../../utils/format.js'
import { nextOrder } from '../../../utils/tree.js'
import { btnIcon, btnPrimary, cardClass, inputClass } from '../../../utils/ui.js'

const loadCompetitions = () => listCollection('competitions')

/**
 * Mantenimiento de competiciones (Liga, Champions, Mundial…). De la competición elegida depende
 * el estilo del nombre y número; cada camisa marca cuáles ofrece.
 */
export default function CompetitionsPage() {
  const dialog = useDialog()
  const { data, loading, error, reload } = useAsync(loadCompetitions)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null) // { id, name }
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const items = [...data].sort((a, b) => a.order - b.order)
  const exists = (text, exceptId) =>
    items.some((c) => c.id !== exceptId && normalizeText(c.name) === normalizeText(text))

  async function run(action, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      setNotice({ type: 'ok', text: okText })
      reload()
      return true
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(event) {
    event.preventDefault()
    if (exists(name)) {
      setNotice({ type: 'error', text: 'Ya existe una competición con ese nombre.' })
      return
    }
    if (await run(() => saveCompetition({ name }, nextOrder(items)), 'Competición creada.')) {
      setName('')
    }
  }

  async function handleRename(competition) {
    if (exists(editing.name, competition.id)) {
      setNotice({ type: 'error', text: 'Ya existe una competición con ese nombre.' })
      return
    }
    const done = await run(
      () => saveCompetition({ ...competition, name: editing.name }),
      'Competición actualizada.',
    )
    if (done) setEditing(null)
  }

  async function handleDelete(competition) {
    const sure = await dialog.confirm({
      title: 'Eliminar competición',
      message: `¿Eliminar la competición "${competition.name}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (sure) run(() => deleteCompetition(competition), 'Competición eliminada.')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Aquí se crean las competiciones una sola vez. En cada camisa eliges cuáles ofrece, y el
        cliente escoge una al personalizar nombre y número.
      </p>
      <form onSubmit={handleAdd} className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <Field label="Nueva competición" className="min-w-48 flex-1">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej. Champions League"
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
          <MdAdd className="size-5" aria-hidden="true" />
          Agregar
        </button>
      </form>
      <Notice notice={notice} />
      {items.length === 0 ? (
        <EmptyState>Aún no hay competiciones.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
              {editing?.id === c.id ? (
                <>
                  <input
                    aria-label={`Nombre de ${c.name}`}
                    value={editing.name}
                    maxLength={60}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    aria-label="Guardar nombre"
                    title="Guardar"
                    disabled={busy || !editing.name.trim()}
                    onClick={() => handleRename(c)}
                    className={btnIcon}
                  >
                    <MdCheck className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar"
                    title="Cancelar"
                    onClick={() => setEditing(null)}
                    className={btnIcon}
                  >
                    <MdClose className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 font-semibold">{c.name}</p>
                  <button
                    type="button"
                    aria-label={`Renombrar ${c.name}`}
                    title="Renombrar"
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                    className={btnIcon}
                  >
                    <MdEdit className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${c.name}`}
                    title="Eliminar"
                    disabled={busy}
                    onClick={() => handleDelete(c)}
                    className={btnIcon}
                  >
                    <MdDelete className="size-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
