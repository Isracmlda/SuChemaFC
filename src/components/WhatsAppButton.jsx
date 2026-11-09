import { FaWhatsapp } from 'react-icons/fa'
import { whatsappLink } from '../features/checkout/checkout.js'
import { DEFAULT_WA_MESSAGE } from '../features/content/content.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadWhatsApp } from '../services/content.js'

// Respaldo mientras no haya número guardado en el admin (Ajustes → WhatsApp de la tienda).
const FALLBACK_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER

/** Botón flotante con el logo de WhatsApp. Número y mensaje inicial vienen de settings/*. */
export default function WhatsAppButton() {
  const { data } = useAsync(loadWhatsApp)
  const href = whatsappLink(data?.number || FALLBACK_NUMBER, data?.message || DEFAULT_WA_MESSAGE)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      title="WhatsApp"
      className="fixed bottom-20 right-4 z-50 inline-flex size-14 items-center justify-center rounded-full border-2 border-brand-black bg-brand-gold text-brand-black shadow-lg hover:bg-accent-solid-hover md:bottom-6"
    >
      <FaWhatsapp className="size-8" aria-hidden="true" />
    </a>
  )
}
