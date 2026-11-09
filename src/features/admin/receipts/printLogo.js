import logoUrl from '../../../assets/logo-print.png'

let cached = null

/**
 * Logo en blanco y negro para las impresiones térmicas (recibos y etiquetas). Se descarga una vez.
 * Si no carga, devuelve null: se imprime igual, sin logo.
 */
export function loadPrintLogo() {
  cached ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = logoUrl
  })
  return cached
}
