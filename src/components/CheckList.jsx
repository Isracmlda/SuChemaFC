/** Casillas para elegir varios elementos de una lista. */
export default function CheckList({ legend, items, selected, onToggle, empty }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <label
              key={i.id}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                selected.includes(i.id)
                  ? 'border-accent bg-surface-2 font-semibold'
                  : 'border-border-strong'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(i.id)}
                onChange={() => onToggle(i.id)}
                className="size-4 accent-[var(--accent-solid)]"
              />
              {i.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
