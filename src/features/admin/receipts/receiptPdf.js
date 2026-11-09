import { formatDateTime } from '../../../utils/dates.js'
import { buildReceiptModel, pdfMoney, pdfText } from './receipts.js'

// Colores de marca como RGB (jsPDF no usa hexadecimales).
const BLACK = [0, 0, 0]
const GOLD = [212, 175, 55]
const WHITE = [255, 255, 255]
const GRAY = [90, 90, 90]

const found = import.meta.glob('../../../assets/logo.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const logoUrl = Object.values(found)[0]

/** Logo oficial reducido a 240 px (el original pesa de más para un PDF). Null si no se pudo. */
async function loadLogo() {
  if (!logoUrl) return null
  try {
    const img = new Image()
    img.src = logoUrl
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 240
    canvas.getContext('2d').drawImage(img, 0, 0, 240, 240)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Genera el recibo en PDF dentro del navegador. Las librerías pesadas (jsPDF y qrcode) se cargan
 * solo al pulsar el botón. `only` es la posición de UNA camisa; sin él, el pedido completo.
 * Devuelve { blob, filename }.
 */
export async function createReceiptPdf(order, { only = null } = {}) {
  const [{ jsPDF }, { default: QRCode }, logo] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
    loadLogo(),
  ])
  const model = buildReceiptModel(order)
  const items = only == null ? model.items : model.items.filter((i) => i.index === only)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 14

  function header() {
    pdf.setFillColor(...BLACK)
    pdf.rect(0, 0, W, 34, 'F')
    if (logo) pdf.addImage(logo, 'PNG', M, 4, 26, 26)
    pdf.setTextColor(...GOLD)
    pdf.setFont('helvetica', 'bolditalic')
    pdf.setFontSize(20)
    pdf.text('SuChemaFC', M + (logo ? 32 : 0), 17)
    pdf.setTextColor(...WHITE)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Tu equipo, tus colores, tu pasion', M + (logo ? 32 : 0), 24)
    pdf.setTextColor(...GOLD)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(`Recibo ${model.ref}`, W - M, 15, { align: 'right' })
    pdf.setTextColor(...WHITE)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(formatDateTime(model.createdAt), W - M, 22, { align: 'right' })
    pdf.setTextColor(...BLACK)
  }

  function footer(page, pages) {
    pdf.setDrawColor(...GOLD)
    pdf.setLineWidth(0.6)
    pdf.line(M, H - 14, W - M, H - 14)
    pdf.setFontSize(8)
    pdf.setTextColor(...GRAY)
    pdf.text(
      'Presenta este recibo al recibir tu camisa. Cada codigo QR identifica una camisa.',
      M,
      H - 9,
    )
    pdf.text(`Pagina ${page} de ${pages}`, W - M, H - 9, { align: 'right' })
  }

  header()
  let y = 44
  pdf.setTextColor(...BLACK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(model.customerName, M, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...GRAY)
  pdf.text(`Tel. ${model.phone}  -  ${model.delivery}`, M, y + 5)
  y += 14

  const QR = 30
  const ROW = QR + 8
  for (const item of items) {
    if (y + ROW > H - 40) {
      pdf.addPage()
      header()
      y = 44
    }
    const qr = await QRCode.toDataURL(item.qrPayload, { margin: 1, width: 240 })
    pdf.setDrawColor(...GOLD)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(M, y, W - 2 * M, ROW, 2, 2)
    pdf.addImage(qr, 'PNG', W - M - QR - 3, y + 4, QR, QR)

    pdf.setTextColor(...BLACK)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(`${item.qty} x ${item.name}`, M + 4, y + 9)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`Talla ${item.size}`, M + 4, y + 15)
    pdf.setTextColor(...GRAY)
    item.extras.slice(0, 3).forEach((extra, i) => pdf.text(extra, M + 4, y + 21 + i * 5))
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...BLACK)
    pdf.text(pdfMoney(item.lineTotal), M + 4, y + ROW - 3)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...GRAY)
    pdf.text(pdfText(`Camisa ${item.index + 1}`), W - M - QR / 2 - 3, y + QR + 7, {
      align: 'center',
    })
    y += ROW + 4
  }

  // Totales (solo en el recibo del pedido completo; el de una camisa lleva su precio).
  if (only == null) {
    if (y + 36 > H - 16) {
      pdf.addPage()
      header()
      y = 44
    }
    const { subtotal, discount, shipping, total, paid, balance } = model.totals
    const lines = [
      ['Subtotal', pdfMoney(subtotal)],
      ...(discount > 0 ? [['Descuento', `- ${pdfMoney(discount)}`]] : []),
      ...(shipping > 0 ? [['Envio', pdfMoney(shipping)]] : []),
      ['Total', pdfMoney(total)],
      ['Pagado', pdfMoney(paid)],
      ['Saldo pendiente', pdfMoney(balance)],
    ]
    pdf.setFontSize(10)
    for (const [label, value] of lines) {
      const strong = label === 'Total' || label === 'Saldo pendiente'
      pdf.setFont('helvetica', strong ? 'bold' : 'normal')
      pdf.setTextColor(...BLACK)
      pdf.text(label, W - M - 70, y)
      pdf.text(value, W - M, y, { align: 'right' })
      y += 6
    }
  }

  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p)
    footer(p, pages)
  }

  const suffix = only == null ? '' : `-camisa${only + 1}`
  return { blob: pdf.output('blob'), filename: `recibo-${model.ref}${suffix}.pdf` }
}

/** Descarga el PDF generado. */
export function downloadBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
