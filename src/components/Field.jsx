/** Etiqueta + control. El <label> envuelve al control, así queda asociado sin necesitar ids. */
export default function Field({ label, hint, className = '', children }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-muted">{hint}</span>}
    </label>
  )
}
