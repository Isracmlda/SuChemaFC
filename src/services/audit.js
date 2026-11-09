import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { clearReadCache } from './db.js'
import { auth, db } from './firebase.js'

/**
 * Aplica varias escrituras y sus entradas de bitácora en UN solo lote (todo o nada).
 * ops: [{ type: 'set' | 'update' | 'delete', ref, data?, merge? }]
 * audit: { action, collection, docId, summary } o una lista de ellos.
 * Las reglas exigen actorUid == uid y createdAt == request.time en auditLog.
 */
export async function commitWithAudit(ops, audit) {
  const batch = writeBatch(db)
  for (const op of ops) {
    if (op.type === 'delete') batch.delete(op.ref)
    else if (op.type === 'update') batch.update(op.ref, op.data)
    else if (op.merge) batch.set(op.ref, op.data, { merge: true })
    else batch.set(op.ref, op.data)
  }
  for (const entry of [audit].flat()) {
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid: auth.currentUser.uid,
      action: entry.action,
      collection: entry.collection,
      docId: entry.docId ?? '',
      summary: entry.summary ?? '',
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
  // Cualquier escritura de admin puede cambiar lo que otras pantallas tienen en memoria.
  clearReadCache()
}
