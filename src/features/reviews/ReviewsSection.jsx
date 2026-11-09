import { useCallback, useState } from 'react'
import { MdExpandMore, MdLogin } from 'react-icons/md'
import DriveImage from '../../components/DriveImage.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../components/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useAuth } from '../../hooks/useAuth.js'
import { authErrorMessage, signInWithGoogle } from '../../services/auth.js'
import { deleteMyReview, getMyReview, listApprovedReviews } from '../../services/reviews.js'
import { formatDateTime, toMillis } from '../../utils/dates.js'
import { errorMessage } from '../../utils/errors.js'
import { btnPrimary, btnSecondary, cardClass } from '../../utils/ui.js'
import ReviewForm from './ReviewForm.jsx'
import Stars from './Stars.jsx'
import { ratingBreakdown, ratingSummary, sortReviews } from './reviews.js'

const PAGE = 5

function ReviewItem({ review }) {
  return (
    <li className={`${cardClass} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{review.authorName}</p>
        <Stars value={review.rating} className="size-4" />
      </div>
      <p className="text-xs text-muted">{formatDateTime(toMillis(review.createdAt))}</p>
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
    </li>
  )
}

function Summary({ reviews }) {
  const { average, count } = ratingSummary(reviews)
  const breakdown = ratingBreakdown(reviews)
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col items-start gap-1">
        <p className="text-4xl font-extrabold">{average.toFixed(1)}</p>
        <Stars value={average} />
        <p className="text-sm text-muted">
          {count} {count === 1 ? 'reseña' : 'reseñas'}
        </p>
      </div>
      <ul className="flex flex-1 flex-col gap-1 text-sm" aria-label="Reseñas por calificación">
        {[5, 4, 3, 2, 1].map((n) => (
          <li key={n} className="flex items-center gap-2">
            <span className="w-14">{n} ★</span>
            <span
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
              aria-hidden="true"
            >
              <span
                className="block h-full bg-accent-solid"
                style={{ width: `${(breakdown[n] / count) * 100}%` }}
              />
            </span>
            <span className="w-6 text-end text-muted">{breakdown[n]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Quién puede escribir: invitado/sin sesión ve el botón de ingresar; con Google, el formulario. */
function Write({ productId, onChanged }) {
  const { user, isGuest, loading, configured } = useAuth()
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const uid = user?.uid
  const canWrite = configured && !loading && user && !isGuest
  const loadMine = useCallback(
    () => (canWrite ? getMyReview(productId, uid) : Promise.resolve(null)),
    [canWrite, productId, uid],
  )
  const { data: mine, loading: loadingMine, error: mineError, reload } = useAsync(loadMine)

  if (!configured || loading) return null

  async function signIn() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(authErrorMessage(e))
      }
    }
  }

  if (!canWrite) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted">Ingresa con Google para dejar tu reseña.</p>
        <button type="button" onClick={signIn} className={btnSecondary}>
          <MdLogin className="size-5" aria-hidden="true" />
          Ingresar con Google
        </button>
        {error && <Notice notice={{ type: 'error', text: error }} />}
      </div>
    )
  }
  if (loadingMine) return <Loading />
  if (mineError) return <ErrorState error={mineError} onRetry={reload} />

  async function remove() {
    try {
      await deleteMyReview(productId, uid)
      setSent(false)
      reload()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (mine || sent) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="status">
          {mine?.approved
            ? 'Tu reseña ya está publicada. ¡Gracias!'
            : 'Recibimos tu reseña. Se publicará cuando el equipo la apruebe.'}
        </p>
        <button type="button" onClick={remove} className={btnSecondary}>
          Borrar mi reseña y escribir otra
        </button>
        {error && <Notice notice={{ type: 'error', text: error }} />}
      </div>
    )
  }
  return (
    <ReviewForm
      productId={productId}
      user={user}
      onSaved={() => {
        setSent(true)
        reload()
      }}
    />
  )
}

/** Reseñas aprobadas de la camisa, promedio, listado paginado y formulario. */
function ReviewsContent({ productId }) {
  const load = useCallback(() => listApprovedReviews(productId), [productId])
  const { data, loading, error, reload } = useAsync(load)
  const [visible, setVisible] = useState(PAGE)

  const reviews = data ? sortReviews(data) : []

  return (
    <div id="reviews-panel" className="flex flex-col gap-5">
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <Summary reviews={reviews} />
          {reviews.length === 0 ? (
            <EmptyState>Aún no hay reseñas. ¡Sé el primero en opinar!</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {reviews.slice(0, visible).map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </ul>
          )}
          {reviews.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className={`${btnPrimary} self-center`}
            >
              Ver más reseñas ({reviews.length - visible})
            </button>
          )}
        </>
      )}
      <Write productId={productId} onChanged={reload} />
    </div>
  )
}

/** Sección plegable (colapsada por defecto). Las reseñas se cargan al abrirla. */
export default function ReviewsSection({ productId }) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-5">
      <h2 id="reviews-title" className="text-xl font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="reviews-panel"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-start"
        >
          Reseñas de clientes
          <MdExpandMore
            className={`size-6 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && <ReviewsContent productId={productId} />}
    </section>
  )
}
