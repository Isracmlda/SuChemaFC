import { formatDateTime } from '../../../utils/dates.js'
import { formatCRC } from '../../../utils/format.js'
import { loadPrintLogo } from './printLogo.js'
import { buildReceiptModel } from './receipts.js'

// Ancho en puntos de una impresora térmica de 57/58 mm (203 dpi): la imagen se imprime 1 a 1.
export const RECEIPT_WIDTH = 384
const PAD = 14
const QUIET = 2 // módulos blancos alrededor del QR
const LOGO = 120 // lado del logo en el encabezado
const QR_TARGET = 240 // lado del QR (un tercio menos que el ancho útil del papel, 356 px)
const FONT = '"Segoe UI", Arial, Helvetica, sans-serif'

/** Tamaño en píxeles de cada cuadro del QR: el mayor entero que no pasa de ~240 px de lado. */
export const qrModulePx = (size) => Math.max(1, Math.floor(QR_TARGET / (size + 2 * QUIET)))

/**
 * Parte un texto en líneas que no pasen de `maxWidth`. `measure` mide un texto en píxeles; una
 * palabra más ancha que la línea se corta por letras.
 */
export function wrapLines(text, maxWidth, measure) {
  const lines = []
  let line = ''
  for (const word of String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)) {
    const attempt = line ? `${line} ${word}` : word
    if (measure(attempt) <= maxWidth) {
      line = attempt
      continue
    }
    if (line) lines.push(line)
    let rest = word
    while (measure(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut -= 1
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    line = rest
  }
  if (line) lines.push(line)
  return lines
}

function setFont(ctx, size, bold) {
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`
}

/** Escribe un texto (con saltos de línea automáticos) y devuelve la nueva posición vertical. */
function text(ctx, y, value, { size = 22, bold = false, align = 'left' } = {}) {
  setFont(ctx, size, bold)
  ctx.textAlign = align
  const x = align === 'center' ? RECEIPT_WIDTH / 2 : align === 'right' ? RECEIPT_WIDTH - PAD : PAD
  const lineHeight = Math.round(size * 1.3)
  for (const line of wrapLines(value, RECEIPT_WIDTH - 2 * PAD, (s) => ctx.measureText(s).width)) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

/** Texto a la izquierda y otro a la derecha en la misma línea. */
function pair(ctx, y, left, right, { size = 22, bold = false } = {}) {
  setFont(ctx, size, bold)
  ctx.textAlign = 'left'
  ctx.fillText(left, PAD, y)
  ctx.textAlign = 'right'
  ctx.fillText(right, RECEIPT_WIDTH - PAD, y)
  return y + Math.round(size * 1.3)
}

/**
 * Encabezado con el logo a la izquierda y, a su lado, "RECIBO", el número de pedido y la fecha,
 * centrados verticalmente respecto al logo. Devuelve la y donde termina.
 */
function logoHeader(ctx, y, model, logo) {
  ctx.drawImage(logo, PAD, y, LOGO, LOGO)
  const x = PAD + LOGO + 12
  const width = RECEIPT_WIDTH - PAD - x
  const rows = [
    { value: 'RECIBO', size: 20, bold: true },
    { value: model.ref, size: 34, bold: true },
    { value: formatDateTime(model.createdAt), size: 16, bold: false },
  ]
  ctx.textAlign = 'center'
  const laid = rows.map((r) => {
    setFont(ctx, r.size, r.bold)
    return { ...r, lines: wrapLines(r.value, width, (s) => ctx.measureText(s).width) }
  })
  const total = laid.reduce((n, r) => n + r.lines.length * Math.round(r.size * 1.25), 0)
  let ty = y + Math.max(0, Math.round((LOGO - total) / 2))
  for (const r of laid) {
    setFont(ctx, r.size, r.bold)
    ctx.textAlign = 'center'
    for (const line of r.lines) {
      ctx.fillText(line, x + width / 2, ty)
      ty += Math.round(r.size * 1.25)
    }
  }
  return y + Math.max(LOGO, total) + 4
}

function separator(ctx, y) {
  ctx.save()
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(PAD, y + 8)
  ctx.lineTo(RECEIPT_WIDTH - PAD, y + 8)
  ctx.stroke()
  ctx.restore()
  return y + 20
}

/** Dibuja el recibo completo y devuelve la posición vertical donde terminó. */
function draw(ctx, model, qr, logo) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, RECEIPT_WIDTH, 5000)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.textBaseline = 'top'

  let y = PAD
  if (logo) {
    y = logoHeader(ctx, y, model, logo)
  } else {
    y = text(ctx, y, 'SuChemaFC', { size: 38, bold: true, align: 'center' })
    y = text(ctx, y, 'Tu equipo, tus colores, tu pasión', { size: 18, align: 'center' })
    y = separator(ctx, y)
    y = text(ctx, y, `RECIBO ${model.ref}`, { size: 28, bold: true, align: 'center' })
    y = text(ctx, y, formatDateTime(model.createdAt), { size: 18, align: 'center' })
  }
  y = separator(ctx, y)

  y = text(ctx, y, model.customerName, { size: 24, bold: true })
  y = text(ctx, y, `Tel. ${model.phone}`)
  if (model.delivery) y = text(ctx, y, model.delivery)
  y = separator(ctx, y)

  for (const item of model.items) {
    y = text(ctx, y, `${item.qty} x ${item.name}`, { size: 24, bold: true })
    y = pair(ctx, y, `Talla ${item.size}`, formatCRC(item.lineTotal))
    for (const extra of item.extras) y = text(ctx, y, extra, { size: 18 })
    y += 8
  }
  y = separator(ctx, y)

  const { subtotal, discount, shipping, total, paid, balance } = model.totals
  y = pair(ctx, y, 'Subtotal', formatCRC(subtotal))
  if (discount > 0) y = pair(ctx, y, 'Descuento', `- ${formatCRC(discount)}`)
  if (shipping > 0) y = pair(ctx, y, 'Envío', formatCRC(shipping))
  y = pair(ctx, y, 'Total', formatCRC(total), { size: 26, bold: true })
  y = pair(ctx, y, 'Pagado', formatCRC(paid))
  y = pair(ctx, y, 'Saldo', formatCRC(balance), { size: 26, bold: true })
  y = separator(ctx, y)

  // Un solo QR para todo el pedido, con cuadros grandes y de tamaño entero para que no se difuminen.
  const px = qrModulePx(qr.size)
  const side = (qr.size + 2 * QUIET) * px
  const x0 = Math.round((RECEIPT_WIDTH - side) / 2)
  y += 6
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (qr.get(row, col)) {
        ctx.fillRect(x0 + (col + QUIET) * px, y + (row + QUIET) * px, px, px)
      }
    }
  }
  y += side + 6

  y = text(ctx, y, 'Presenta este recibo al recibir tus camisas.', { size: 18, align: 'center' })
  y = text(ctx, y, '¡Gracias por tu compra!', { size: 22, bold: true, align: 'center' })
  return y + PAD
}

const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

/**
 * Genera el recibo como imagen PNG de 384 px de ancho, lista para la impresora térmica. El alto se
 * ajusta al contenido. La librería de QR se carga solo al usarla.
 * Devuelve { dataUrl, base64, blob, filename }.
 */
export async function createReceiptImage(order) {
  const { default: QRCode } = await import('qrcode')
  const model = buildReceiptModel(order)
  const logo = await loadPrintLogo()
  const { modules } = QRCode.create(model.qrPayload, { errorCorrectionLevel: 'M' })

  // Primero se mide sobre un lienzo alto; después se dibuja en uno del alto justo.
  const probe = document.createElement('canvas')
  probe.width = RECEIPT_WIDTH
  probe.height = 5000
  const height = Math.ceil(draw(probe.getContext('2d'), model, modules, logo))

  const canvas = document.createElement('canvas')
  canvas.width = RECEIPT_WIDTH
  canvas.height = height
  draw(canvas.getContext('2d'), model, modules, logo)

  const dataUrl = canvas.toDataURL('image/png')
  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    blob: await canvasToBlob(canvas),
    filename: `recibo-${model.ref}.png`,
  }
}

/** Descarga la imagen generada. */
export function downloadImage({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
