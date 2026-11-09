import { MdFavorite } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import ProductCard from '../features/catalog/ProductCard.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useCart } from '../hooks/useCart.js'
import { loadCatalog } from '../services/storefront.js'
import { btnPrimary, btnSecondary } from '../utils/ui.js'

const load = () => loadCatalog()

export default function Wishlist() {
  const { wishlist, toggleWishlist } = useCart()
  const { data: catalog, loading, error, reload } = useAsync(load)

  if (wishlist.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4">
        <h1 className="self-start text-2xl font-bold">Lista de deseos</h1>
        <EmptyState>Aún no guardas ninguna camisa. Toca el corazón en su detalle.</EmptyState>
        <Link to="/" className={btnPrimary}>
          Ver catálogo
        </Link>
      </section>
    )
  }
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  // Las camisas que ya no están en el catálogo simplemente no se muestran.
  const products = wishlist.map((id) => catalog.products.find((p) => p.id === id)).filter(Boolean)

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Lista de deseos</h1>
      {products.length === 0 ? (
        <EmptyState>Las camisas que guardaste ya no están disponibles.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id} className="flex flex-col gap-2">
              <ProductCard product={p} />
              <div className="flex gap-2">
                <Link to={`/producto/${p.id}`} className={`${btnPrimary} flex-1 px-2`}>
                  Elegir talla
                </Link>
                <button
                  type="button"
                  aria-label={`Quitar ${p.name} de la lista de deseos`}
                  title="Quitar de la lista"
                  onClick={() => toggleWishlist(p.id)}
                  className={`${btnSecondary} px-3`}
                >
                  <MdFavorite className="size-5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
