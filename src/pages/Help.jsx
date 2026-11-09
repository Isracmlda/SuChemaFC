import RichText from '../components/RichText.jsx'
import { ErrorState, Loading } from '../components/States.jsx'
import { fillTemplate } from '../features/content/content.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadContentBundle } from '../services/content.js'
import { whatsappLink } from '../features/checkout/checkout.js'

const SECTIONS = [
  { id: 'como-comprar', title: 'Cómo comprar' },
  { id: 'preguntas-frecuentes', title: 'Preguntas frecuentes' },
  { id: 'envios', title: 'Envíos y entrega' },
  { id: 'cambios', title: 'Cambios y devoluciones' },
  { id: 'terminos', title: 'Términos y condiciones' },
]

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** Página de ayuda: el contenido lo edita el admin (Admin → Contenido). */
export default function Help() {
  const { data, loading, error, reload } = useAsync(loadContentBundle)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { content, vars, whatsappNumber } = data
  const fill = (text) => fillTemplate(text, vars)
  const contact = whatsappLink(whatsappNumber, content.whatsappMessage)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Ayuda</h1>
        <p className="text-muted">Todo lo que necesitás saber para comprar en SuChemaFC.</p>
      </header>

      <nav aria-label="Secciones de ayuda" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <Section id="como-comprar" title="Cómo comprar">
        <RichText text={fill(content.howToBuy)} />
      </Section>

      <Section id="preguntas-frecuentes" title="Preguntas frecuentes">
        <div className="divide-y divide-border">
          {content.faq.map((f) => (
            <details key={f.q} className="py-3">
              <summary className="cursor-pointer font-semibold">{fill(f.q)}</summary>
              <p className="mt-2 text-muted">{fill(f.a)}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="envios" title="Envíos y entrega">
        <RichText text={fill(content.shipping)} />
      </Section>

      <Section id="cambios" title="Cambios y devoluciones">
        <RichText text={fill(content.returns)} />
      </Section>

      <Section id="terminos" title="Términos y condiciones">
        <RichText text={fill(content.terms)} />
      </Section>

      {contact && (
        <p className="text-center">
          ¿Más dudas?{' '}
          <a
            href={contact}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent underline"
          >
            Escribinos por WhatsApp
          </a>
          .
        </p>
      )}
    </div>
  )
}
