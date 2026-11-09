import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Impresión con PuraPrint (PWA que imprime en mini impresoras térmicas por Bluetooth), con el mismo
 * protocolo que Asiscate:
 *  - Navegador normal: se abre PuraPrint en una ventana y se le manda la imagen con `postMessage`.
 *  - App instalada (standalone): `postMessage` no llega a otra app, así que la imagen se guarda en
 *    `printJobs` y PuraPrint la lee con `?job=<id>&src=suchema` (necesita su fuente "suchema").
 */
export const PURAPRINT_URL = 'https://crpuraprint.web.app'
const SOURCE = 'suchema'
const READY_TIMEOUT_MS = 15000
const RETRY_EVERY_MS = 400
const MAX_RETRIES = 25

/** ¿La app corre instalada (PWA) o en un WebView, donde `window.open` sale a otro navegador? */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  )
}

/**
 * Abre PuraPrint. Debe llamarse DENTRO del clic (si no, el navegador bloquea la ventana).
 * Devuelve { send(payload), close() } o null si el navegador la bloqueó.
 */
export function openPuraPrint() {
  const win = window.open(PURAPRINT_URL, 'puraprint', 'width=640,height=750')
  if (!win) return null

  let payload = null
  let sent = false
  let timer = null
  let interval = null

  const post = () => {
    if (!payload) return
    try {
      win.postMessage({ type: 'PURAPRINT_INVOICE', payload }, PURAPRINT_URL)
    } catch (error) {
      console.warn('No se pudo enviar el recibo a PuraPrint', error)
    }
  }

  const stop = () => {
    window.removeEventListener('message', onMessage)
    clearTimeout(timer)
    clearInterval(interval)
  }

  // PuraPrint avisa cuando está listo (READY) y confirma la recepción (ACK): ahí se dejan los reintentos.
  function onMessage(event) {
    if (event.source !== win) return
    const type = event.data?.type
    if (type === 'PURAPRINT_READY') post()
    if (type === 'PURAPRINT_ACK') {
      sent = true
      stop()
    }
  }

  window.addEventListener('message', onMessage)
  timer = setTimeout(stop, READY_TIMEOUT_MS)

  return {
    send(data) {
      payload = data
      let tries = 0
      post()
      // La ventana puede tardar en montar (sobre todo en móvil): se reintenta hasta el ACK.
      interval = setInterval(() => {
        tries += 1
        if (sent || tries > MAX_RETRIES) clearInterval(interval)
        else post()
      }, RETRY_EVERY_MS)
    },
    close() {
      stop()
      if (!win.closed) win.close()
    },
  }
}

/** Guarda la imagen como trabajo de impresión. Devuelve el ID del documento. */
async function savePrintJob({ image, title, orderId }) {
  const ref = await addDoc(collection(db, 'printJobs'), {
    image,
    title,
    orderId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** App instalada: guarda el trabajo y abre PuraPrint con su ID (la imagen es muy grande para la URL). */
export async function printViaJob({ image, title, orderId }) {
  const jobId = await savePrintJob({ image, title, orderId })
  const url = new URL(PURAPRINT_URL)
  url.searchParams.set('job', jobId)
  url.searchParams.set('src', SOURCE)
  url.searchParams.set('title', title)
  window.open(url.toString(), '_blank', 'noopener')
}

/**
 * Imprime el recibo. `generate()` devuelve la imagen (Data URL); se abre PuraPrint primero, dentro
 * del clic, y la imagen se manda cuando está lista. Lanza un Error con un mensaje para el admin.
 */
export async function printReceipt({ generate, title, orderId }) {
  if (isStandalone()) {
    await printViaJob({ image: await generate(), title, orderId })
    return
  }
  const session = openPuraPrint()
  if (!session) {
    throw new Error(
      'El navegador bloqueó la ventana de PuraPrint. Permite las ventanas emergentes.',
    )
  }
  try {
    session.send({ image: await generate(), title })
  } catch (error) {
    session.close()
    throw error
  }
}
