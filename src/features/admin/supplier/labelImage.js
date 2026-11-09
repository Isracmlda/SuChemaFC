import { loadPrintLogo } from '../receipts/printLogo.js'
import { RECEIPT_WIDTH, wrapLines } from '../receipts/receiptImage.js'

// Misma anchura que el recibo: 384 puntos de una impresora térmica de 57/58 mm (se imprime 1 a 1).
const PAD = 12
const GAP = 12
const QUIET = 2 // módulos blancos alrededor del QR
const QR_TARGET = 168 // ancho que se busca para el QR
const FONT = '"Segoe UI", Arial, Helvetica, sans-serif'
const FULL = RECEIPT_WIDTH - 2 * PAD

/** Tamaño en píxeles de cada cuadro del QR: el mayor entero que no pase de ~168 px de lado. */
export const labelQrPx = (size) => Math.max(1, Math.floor(QR_TARGET / (size + 2 * QUIET)))

function setFont(ctx, size, bold) {
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`
}

/** Escribe un texto con saltos automáticos en la columna [x, x + width] y devuelve la nueva y. */
function text(ctx, x, y, width, value, { size = 20, bold = false, align = 'left' } = {}) {
  setFont(ctx, size, bold)
  ctx.textAlign = align
  const at = align === 'center' ? x + width / 2 : x
  const lineHeight = Math.round(size * 1.25)
  for (const line of wrapLines(value, width, (s) => ctx.measureText(s).width)) {
    ctx.fillText(line, at, y)
    y += lineHeight
  }
  return y
}

/** Línea divisoria a todo el ancho en `y`; devuelve la y donde sigue el contenido. */
function divider(ctx, y) {
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(RECEIPT_WIDTH - PAD, y)
  ctx.stroke()
  return y + 8
}

/**
 * Dibuja la etiqueta y devuelve su alto. Arriba: el QR a la izquierda y, a la derecha y de su misma
 * altura, el logo grande y el número de pedido (chico). Debajo, a todo el ancho: camisa y talla,
 * parches, personalización, una línea, la dirección (solo Correos) y, al final tras otra línea,
 * el nombre del cliente.
 */
function draw(ctx, label, qr, logo) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, RECEIPT_WIDTH, 2000)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.textBaseline = 'top'

  const px = labelQrPx(qr.size)
  const side = (qr.size + 2 * QUIET) * px
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (qr.get(row, col)) {
        ctx.fillRect(PAD + (col + QUIET) * px, PAD + (row + QUIET) * px, px, px)
      }
    }
  }

  // Columna derecha, de la misma altura que el QR: el logo toma todo el espacio que deja el
  // número de pedido (una sola línea chica) y se limita al ancho de la columna.
  const x = PAD + side + GAP
  const width = RECEIPT_WIDTH - PAD - x
  const refHeight = Math.round(14 * 1.25)
  const logoSize = logo ? Math.max(40, Math.min(width, side - refHeight - 6)) : 0
  let y = PAD
  if (logo) {
    ctx.drawImage(logo, x + Math.round((width - logoSize) / 2), y, logoSize, logoSize)
    y += logoSize + 6
  }
  text(ctx, x, y, width, label.ref, { size: 14, bold: true, align: 'center' })

  // Datos de la camisa a todo el ancho de la etiqueta.
  y = divider(ctx, PAD + side + 8)

  // Nombre de la camisa y talla en un solo texto: "Man City Alternativa 2024/2025 - XL".
  y = text(ctx, PAD, y, FULL, `${label.shirt} - ${label.size}`, { size: 30, bold: true })
  if (label.patches.length > 0) {
    y = text(ctx, PAD, y + 2, FULL, `Parches: ${label.patches.join(', ')}`, {
      size: 22,
      bold: true,
    })
  }
  if (label.custom) {
    y = text(ctx, PAD, y + 2, FULL, `Personalizada: ${label.custom}`, { size: 22, bold: true })
  }
  if (label.address) {
    y = divider(ctx, y + 4)
    y = text(ctx, PAD, y, FULL, `Envío: ${label.address}`, { size: 20, bold: true })
  }
  if (label.copies > 1) {
    y = text(ctx, PAD, y + 2, FULL, `Camisa ${label.copy} de ${label.copies}`, { size: 18 })
  }

  // Al final, tras otra línea, el nombre del cliente.
  y = divider(ctx, y + 4)
  y = text(ctx, PAD, y, FULL, label.customerName, { size: 26, bold: true, align: 'center' })

  return Math.ceil(y + PAD)
}

/**
 * Etiqueta de una camisa como imagen PNG de 384 px de ancho para la impresora térmica. El QR lleva
 * la guía de rastreo del pedido del cliente. `QRCode` es la librería `qrcode` ya cargada y `logo`
 * la imagen del logo (o null). Devuelve la imagen como Data URL.
 */
export function createLabelImage(label, QRCode, logo = null) {
  const { modules } = QRCode.create(label.qrPayload, { errorCorrectionLevel: 'M' })

  // Primero se mide sobre un lienzo alto; después se dibuja en uno del alto justo.
  const probe = document.createElement('canvas')
  probe.width = RECEIPT_WIDTH
  probe.height = 2000
  const height = draw(probe.getContext('2d'), label, modules, logo)

  const canvas = document.createElement('canvas')
  canvas.width = RECEIPT_WIDTH
  canvas.height = height
  draw(canvas.getContext('2d'), label, modules, logo)
  return canvas.toDataURL('image/png')
}

/** Imágenes de todas las etiquetas. La librería de QR y el logo se cargan solo al usarlas. */
export async function createLabelImages(labels) {
  const [{ default: QRCode }, logo] = await Promise.all([import('qrcode'), loadPrintLogo()])
  return labels.map((label) => createLabelImage(label, QRCode, logo))
}
