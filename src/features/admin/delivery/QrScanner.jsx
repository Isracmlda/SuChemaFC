import { useEffect, useRef, useState } from 'react'
import { MdCameraAlt, MdStop } from 'react-icons/md'
import { btnPrimary, btnSecondary } from '../../../utils/ui.js'

const SCAN_EVERY_MS = 250

/**
 * Detecta un QR en un fotograma: usa `BarcodeDetector` si el navegador lo trae y, si no,
 * jsQR sobre un canvas (se carga solo cuando hace falta).
 */
async function createDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? ''
    } catch {
      // cae a jsQR
    }
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!video.videoWidth) return ''
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(data.data, data.width, data.height)?.data ?? ''
  }
}

function cameraError(error) {
  if (error?.name === 'NotAllowedError') return 'Permite el acceso a la cámara para escanear.'
  if (error?.name === 'NotFoundError') return 'No se encontró ninguna cámara en este dispositivo.'
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Este navegador no permite usar la cámara (se necesita una conexión segura).'
  }
  return 'No se pudo abrir la cámara. Usa el ingreso manual.'
}

/** Escáner de QR con la cámara trasera. Llama a `onScan(texto)` una vez y se detiene. */
export default function QrScanner({ onScan }) {
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return undefined
    let stopped = false
    let stream
    let timer

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const detect = await createDetector()

        const tick = async () => {
          if (stopped) return
          const text = await detect(video).catch(() => '')
          if (text) {
            setActive(false)
            onScan(text)
            return
          }
          timer = setTimeout(tick, SCAN_EVERY_MS)
        }
        tick()
      } catch (e) {
        if (!stopped) {
          setError(cameraError(e))
          setActive(false)
        }
      }
    }
    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, onScan])

  return (
    <div className="flex flex-col gap-3">
      {active ? (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Vista de la cámara para escanear el código QR"
            className="aspect-square w-full max-w-sm rounded-lg border-2 border-accent bg-black object-cover"
          />
          <button
            type="button"
            onClick={() => setActive(false)}
            className={`${btnSecondary} self-start`}
          >
            <MdStop className="size-5" aria-hidden="true" />
            Detener cámara
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError('')
            setActive(true)
          }}
          className={`${btnPrimary} self-start`}
        >
          <MdCameraAlt className="size-5" aria-hidden="true" />
          Escanear con la cámara
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  )
}
