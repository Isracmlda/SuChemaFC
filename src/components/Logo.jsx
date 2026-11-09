// Logo oficial de SuChemaFC: el emblema circular negro/dorado entregado por el cliente.
// Debe guardarse en src/assets/logo.png (también se acepta .webp o .svg).
// Mientras el archivo no exista se muestra solo el nombre en texto (NO es el logo oficial).
const found = import.meta.glob('../assets/logo.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const logoUrl = Object.values(found)[0]
// Copia de 160 px para los tamaños chicos (navbar, tarjetas): evita descargar el original de 375 KB.
const smallLogoUrl = Object.values(
  import.meta.glob('../assets/logo-small.png', { eager: true, query: '?url', import: 'default' }),
)[0]

const SIZES = {
  sm: { box: 'h-10 w-10', text: 'text-sm', small: true },
  nav: { box: 'h-12 w-12', text: 'text-base', small: true },
  md: { box: 'h-14 w-14', text: 'text-base', small: true },
  lg: { box: 'h-28 w-28', text: 'text-2xl' },
  xl: { box: 'h-48 w-48', text: 'text-4xl' },
}

/**
 * Logo de SuChemaFC. El emblema tiene fondo negro, por eso siempre se recorta en círculo
 * para que no aparezca un cuadrado negro sobre superficies claras.
 */
export default function Logo({ size = 'md', className = '' }) {
  const { box, text, small } = SIZES[size] ?? SIZES.md
  const url = (small && smallLogoUrl) || logoUrl

  if (url) {
    return (
      <img
        src={url}
        alt="SuChemaFC"
        width={160}
        height={160}
        className={`${box} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  // Sin archivo de logo: solo texto, para no mostrar una imitación del emblema.
  return (
    <span
      role="img"
      aria-label="SuChemaFC"
      className={`inline-flex shrink-0 items-center font-extrabold italic ${text} ${className}`}
    >
      <span className="text-brand-white">SuChema</span>
      <span className="text-brand-gold">FC</span>
    </span>
  )
}
