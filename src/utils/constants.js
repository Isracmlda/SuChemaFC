/** Tallas que se ofrecen en toda la tienda. Los recargos por talla se definen por producto. */
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
/** Máximo de imágenes por camisa (y por cada versión que tenga las suyas). */
export const MAX_PRODUCT_IMAGES = 2

/** Admin fijo: siempre es admin, no se le puede quitar el rol ni eliminar (ver firestore.rules). */
export const SUPER_ADMIN_EMAIL = 'crsuchema@gmail.com'

/** true si el correo es el del admin fijo (sin distinguir mayúsculas). */
export const isSuperAdminEmail = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase() === SUPER_ADMIN_EMAIL
