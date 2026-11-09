import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { buildReview, reviewId } from '../features/reviews/reviews.js'
import { commitWithAudit } from './audit.js'
import { deleteDriveFile } from './drive.js'
import { docRef } from './db.js'
import { db } from './firebase.js'

const MAX_LOADED = 100

/** Reseñas aprobadas de una camisa (sin orden: se ordena en el cliente para no pedir índice). */
export async function listApprovedReviews(productId) {
  const q = query(
    collection(db, 'reviews'),
    where('productId', '==', productId),
    where('approved', '==', true),
    limit(MAX_LOADED),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** La reseña del usuario para esa camisa (aprobada o no), o null. */
export async function getMyReview(productId, uid) {
  const snap = await getDoc(doc(db, 'reviews', reviewId(productId, uid)))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Crea la reseña propia. Queda sin aprobar hasta que el admin la modere. */
export function createReview(input) {
  return setDoc(doc(db, 'reviews', reviewId(input.productId, input.uid)), {
    ...buildReview(input),
    createdAt: serverTimestamp(),
  })
}

/** El dueño borra su reseña (por ejemplo, para escribir otra). */
export function deleteMyReview(productId, uid) {
  return deleteDoc(doc(db, 'reviews', reviewId(productId, uid)))
}

/** Admin: reseñas pendientes de moderar. */
export async function listPendingReviews() {
  const snap = await getDocs(
    query(collection(db, 'reviews'), where('approved', '==', false), limit(MAX_LOADED)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Admin: publica la reseña. */
export function approveReview(review) {
  return commitWithAudit(
    [{ type: 'update', ref: docRef('reviews', review.id), data: { approved: true } }],
    {
      action: 'editar',
      collection: 'reviews',
      docId: review.id,
      summary: `Reseña de ${review.authorName} aprobada`.slice(0, 500),
    },
  )
}

/** Admin: rechaza (borra) la reseña y manda sus fotos a la papelera de Drive (si se puede). */
export async function rejectReview(review) {
  await commitWithAudit([{ type: 'delete', ref: docRef('reviews', review.id) }], {
    action: 'eliminar',
    collection: 'reviews',
    docId: review.id,
    summary: `Reseña de ${review.authorName} rechazada`.slice(0, 500),
  })
  await Promise.allSettled((review.photos ?? []).map((id) => deleteDriveFile(id)))
}
