const ERROR_TEXT = {
  'permission-denied': 'No tienes permiso para ver o modificar estos datos.',
  unavailable: 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.',
}

/** Mensaje en español para un error de Firebase o de la app. */
export function errorMessage(error) {
  return ERROR_TEXT[error?.code] ?? error?.message ?? 'Ocurrió un error inesperado.'
}
