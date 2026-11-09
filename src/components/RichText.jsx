import { parseBlocks, parseInline } from '../features/content/content.js'

function Inline({ text }) {
  return parseInline(text).map((p, i) =>
    p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>,
  )
}

/** Muestra texto simple (títulos, listas, negritas) como elementos de React: nunca inserta HTML. */
export default function RichText({ text }) {
  return (
    <div className="flex flex-col gap-3">
      {parseBlocks(text).map((b, i) => {
        if (b.type === 'h') {
          return (
            <h3 key={i} className="font-bold">
              <Inline text={b.text} />
            </h3>
          )
        }
        if (b.type === 'ul' || b.type === 'ol') {
          const List = b.type === 'ul' ? 'ul' : 'ol'
          return (
            <List
              key={i}
              className={`space-y-2 ps-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'}`}
            >
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          )
        }
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        )
      })}
    </div>
  )
}
