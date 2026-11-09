import { toInt } from '../utils/format.js'
import { inputClass } from '../utils/ui.js'

/**
 * Campo de monto entero. El 0 se muestra vacío (con "0" de guía) para poder escribir sin tener
 * que borrar un cero que no se quita. `onChange` recibe siempre un entero (vacío = 0).
 */
export default function NumberInput({ value, onChange, className = inputClass, ...rest }) {
  return (
    <input
      type="number"
      min="0"
      step="1"
      inputMode="numeric"
      placeholder="0"
      value={value ? value : ''}
      onChange={(e) => onChange(toInt(e.target.value))}
      className={className}
      {...rest}
    />
  )
}
