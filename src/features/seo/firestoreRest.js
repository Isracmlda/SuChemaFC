/** Lectura de documentos de la API REST de Firestore (la usa el script de prerender en Node). */

/** Convierte un valor tipado de la API REST (`{ stringValue: ... }`) en un valor de JavaScript. */
export function decodeValue(value) {
  if (!value || typeof value !== 'object') return null
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return Date.parse(value.timestampValue)
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields)
  return null
}

export function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]))
}

/** Documento de la API REST → `{ id, ...campos }`. */
export function decodeDocument(doc) {
  return { id: doc.name.split('/').pop(), ...decodeFields(doc.fields) }
}

/** Cuerpo de `runQuery` para las camisas visibles y no eliminadas (lo que permiten las reglas). */
export const VISIBLE_PRODUCTS_QUERY = {
  structuredQuery: {
    from: [{ collectionId: 'products' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'visible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'deleted' },
              op: 'EQUAL',
              value: { booleanValue: false },
            },
          },
        ],
      },
    },
  },
}

/** Respuesta de `runQuery` (lista de `{ document }`) → camisas. */
export const decodeQueryResult = (rows) =>
  rows.filter((r) => r.document).map((r) => decodeDocument(r.document))
