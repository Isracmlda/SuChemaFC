import { useLocation } from 'react-router-dom'
import { pageMeta } from '../features/seo/seo.js'
import { usePageMeta } from './usePageMeta.js'

/** Título de la pestaña según la ruta actual (las camisas ponen el suyo en `Product`). */
export default function usePageMetaForRoute() {
  const { pathname } = useLocation()
  const meta = pageMeta(pathname)
  usePageMeta(meta?.title ?? '', meta?.description ?? '', meta !== null)
}
