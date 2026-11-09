import { auth } from './firebase.js'
import { ensureSession } from './auth.js'

const SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

// Límites del cliente (el script aplica los suyos: 4 MB y firma del archivo).
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.82
const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024

const ERROR_MESSAGES = {
  no_autenticado: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  no_autorizado: 'No tienes permiso para esta acción.',
  requiere_google: 'Inicia sesión con Google para continuar.',
  tipo_no_permitido: 'Solo se permiten imágenes JPG, PNG o WebP.',
  archivo_muy_grande: 'La imagen es demasiado grande.',
  archivo_vacio: 'No se recibió ninguna imagen.',
  contenido_no_coincide: 'El archivo no es una imagen válida.',
  archivo_no_encontrado: 'El archivo ya no existe.',
  archivo_no_permitido: 'Ese archivo no se puede usar.',
  demasiadas_solicitudes: 'Has hecho demasiadas solicitudes. Espera un rato e intenta de nuevo.',
  falta_configuracion: 'El servidor de imágenes no está configurado.',
  no_se_pudo_compartir:
    'Drive no permitió compartir la imagen. Revisa que la carpeta Chemas sea tuya y permita compartir con enlace.',
  no_puedes_eliminarte: 'No puedes eliminar tu propia cuenta.',
  usuario_protegido: 'Esa cuenta es el administrador principal y no se puede eliminar.',
  no_se_pudo_eliminar: 'No se pudo eliminar la cuenta de acceso del usuario.',
  pedido_no_encontrado: 'No se encontró el pedido.',
}

export class DriveError extends Error {
  constructor(code, detail) {
    super(
      ERROR_MESSAGES[code] ??
        `No se pudo completar la operación (${detail || code || 'sin código'}). Intenta de nuevo.`,
    )
    this.code = code
  }
}

/**
 * URL pública de una imagen del catálogo o de una reseña. `size` es el ancho en píxeles
 * (por ejemplo 400 para miniaturas, 1200 para el detalle). `attempt` elige una URL alternativa
 * (0 es la principal) para cuando Drive no sirve la imagen por la primera.
 */
export const DRIVE_IMAGE_ATTEMPTS = 3

export function driveImageUrl(fileId, size = 800, attempt = 0) {
  if (!fileId) return ''
  const id = encodeURIComponent(fileId)
  if (attempt === 1) return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
  if (attempt >= 2) return `https://drive.google.com/uc?export=view&id=${id}`
  return `https://lh3.googleusercontent.com/d/${id}=w${size}`
}

/**
 * Reduce la imagen a un máximo de 1600 px por lado y la convierte a WebP.
 * Devuelve { base64, mimeType }. Si el navegador no puede codificar WebP, usa JPEG.
 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new DriveError('tipo_no_permitido')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
  if (blob?.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', WEBP_QUALITY)
  if (!blob) throw new DriveError('contenido_no_coincide')
  if (blob.size > MAX_UPLOAD_BYTES) throw new DriveError('archivo_muy_grande')

  return { base64: await blobToBase64(blob), mimeType: blob.type }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Llama a una acción del Apps Script. Se envía como text/plain para que sea una petición
 * "simple" y el navegador no haga preflight de CORS (Apps Script no responde a OPTIONS).
 */
export async function callScript(action, payload = {}, { requireSession = false } = {}) {
  if (!SCRIPT_URL) throw new DriveError('falta_configuracion')

  const user = requireSession ? await ensureSession() : auth?.currentUser
  if (!user) throw new DriveError('no_autenticado')
  const idToken = await user.getIdToken()

  let data
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, ...payload }),
    })
    data = await res.json()
  } catch (cause) {
    console.warn('Apps Script: no se pudo leer la respuesta', cause)
    throw new DriveError('red')
  }
  if (!data.ok) {
    throw new DriveError(data.error, data.detail)
  }
  return data
}

/** Admin: sube una imagen del catálogo (carpeta pública). Devuelve el ID de Drive. */
export async function uploadCatalogImage(file) {
  const image = await compressImage(file)
  return (await callScript('uploadCatalogImage', image)).fileId
}

/** Cliente con Google: sube una foto de reseña (carpeta pública, pendiente de moderación). */
export async function uploadReviewPhoto(file) {
  const image = await compressImage(file)
  return (await callScript('uploadReviewPhoto', image)).fileId
}

/** Cualquier sesión (crea una anónima si hace falta): sube un comprobante SINPE (carpeta privada). */
export async function uploadReceipt(file) {
  const image = await compressImage(file)
  return (await callScript('uploadReceipt', image, { requireSession: true })).fileId
}

/** Admin: descarga un comprobante. Devuelve una URL de datos lista para un <img>. */
export async function getReceiptDataUrl(fileId) {
  const { mimeType, base64 } = await callScript('getReceipt', { fileId })
  return `data:${mimeType};base64,${base64}`
}

/** Admin: manda un archivo de Drive a la papelera. */
export async function deleteDriveFile(fileId) {
  await callScript('deleteFile', { fileId })
}
