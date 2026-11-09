import { MdStar, MdStarBorder } from 'react-icons/md'

/** Estrellas de solo lectura con texto accesible ("4 de 5"). */
export default function Stars({ value, className = 'size-5' }) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex" role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= rounded ? (
          <MdStar key={n} className={`${className} text-accent`} aria-hidden="true" />
        ) : (
          <MdStarBorder key={n} className={`${className} text-muted`} aria-hidden="true" />
        ),
      )}
    </span>
  )
}
