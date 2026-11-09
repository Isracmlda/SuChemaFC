import { useState } from 'react'
import { MdCheck, MdDelete } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { listCollection } from '../../../services/db.js'
import { approveReview, listPendingReviews, rejectReview } from '../../../services/reviews.js'
import { formatDateTime, toMillis } from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { actionRowClass, btnDanger, btnPrimary, cardClass } from '../../../utils/ui.js'
import Stars from '../../reviews/Stars.jsx'
import { sortReviews } from '../../reviews/reviews.js'

async function loadAll() {
  const [pending, products] = await Promise.all([listPendingReviews(), listCollection('products')])
  return {
    pending: sortReviews(pending),
    names: Object.fromEntries(products.map((p) => [p.id, p.name])),
  }
}

function PendingReview({ review, productName, onDone }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function run(action, doneText) {
    setBusy(true)
    setNotice(null)
    try {
      await action(review)
      onDone(doneText)
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <li className={`${cardClass} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{productName ?? 'Camisa eliminada'}</p>
        <Stars value={review.rating} className="size-4" />
      </div>
      <p className="text-sm text-muted">
        {review.authorName} · {formatDateTime(toMillis(review.createdAt))}
      </p>
      {review.text && <p className="whitespace-pre-line">{review.text}</p>}
      {review.photos?.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos de la reseña">
          {review.photos.map((id) => (
            <li key={id}>
              <DriveImage
                id={id}
                size={320}
                alt="Foto de la reseña"
                className="size-24 rounded-md"
              />
            </li>
          ))}
        </ul>
      )}
      <Notice notice={notice} />
      <div className={actionRowClass}>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(approveReview, 'Reseña publicada.')}
          className={btnPrimary}
        >
          <MdCheck className="size-5" aria-hidden="true" />
          Aprobar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(rejectReview, 'Reseña rechazada y eliminada.')}
          className={btnDanger}
        >
          <MdDelete className="size-5" aria-hidden="true" />
          Rechazar
        </button>
      </div>
    </li>
  )
}

/** Cola de moderación: las reseñas no son públicas hasta que el admin las aprueba. */
export default function ReviewsPage() {
  const { data, loading, error, reload } = useAsync(loadAll)
  const [done, setDone] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Reseñas por moderar</h1>
      <Notice notice={done && { type: 'ok', text: done }} />
      {data.pending.length === 0 ? (
        <EmptyState>No hay reseñas pendientes.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.pending.map((r) => (
            <PendingReview
              key={r.id}
              review={r}
              productName={data.names[r.productId]}
              onDone={(text) => {
                setDone(text)
                reload()
              }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
