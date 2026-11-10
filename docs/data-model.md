# Modelo de datos de SuChemaFC (Firestore)

Fuente de verdad del esquema. Las reglas están en [`firestore.rules`](../firestore.rules) y se prueban con el emulador (`npm run test:rules`).

**Convenciones**

- Moneda: colones (CRC), siempre números enteros.
- Fechas: `timestamp` de Firestore. Las fechas de creación se escriben con `serverTimestamp()` (las reglas exigen `== request.time`).
- Borrado: nunca se borra físicamente. Se usa `deleted: true` (soft delete). Los productos y pedidos siempre llevan el campo `deleted` (bool).
- Sin Cloud Functions (plan Spark): las reglas son la única barrera del servidor. Ver "Limitaciones" al final.
- Admin: sesión de Google (no anónima) y, o bien el correo verificado `crsuchema@gmail.com` (admin fijo, no depende de ningún documento), o bien existe el documento `admins/{uid}`.
- Los _hashtags_ y alias se guardan normalizados (minúsculas, sin acentos).

## Resumen de acceso

| Colección                                                                                     | Lectura                                                            | Escritura                                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `admins/{uid}`                                                                                | el propio usuario o un admin                                       | admin                                                                          |
| `users/{uid}`                                                                                 | dueño o admin                                                      | dueño (Google), con validación; un admin puede borrar (no el suyo ni el fijo)  |
| `sections`, `tags`, `patchGroups`, `competitions`, `sizeCharts`, `paymentMethods`, `settings` | pública                                                            | admin                                                                          |
| `products/{id}`                                                                               | pública solo si `visible == true` y `deleted == false`; admin todo | admin                                                                          |
| `productPrivate/{id}`                                                                         | admin                                                              | admin                                                                          |
| `coupons/{code}`                                                                              | `get` con sesión (sin `list`); admin todo                          | admin; cualquier sesión solo puede registrar un uso (ver reglas)               |
| `orders/{id}`                                                                                 | dueño o admin                                                      | crea cualquier sesión (incluida anónima); solo admin actualiza                 |
| `orderPrivate/{id}`                                                                           | admin                                                              | admin                                                                          |
| `printJobs/{id}`                                                                              | `get` público por ID (PuraPrint); `list` solo admin                | crea y borra solo admin; sin `update`                                          |
| `orderTracking/{code}`                                                                        | `get` público por código; `list` solo admin                        | crea el dueño del pedido junto con el pedido; actualiza admin                  |
| `supplierOrders/{id}`                                                                         | admin                                                              | admin                                                                          |
| `reviews/{productId_uid}`                                                                     | pública si `approved == true`; dueño y admin                       | crea sesión de Google (`approved == false`); modera admin; borra dueño o admin |
| `paymentRefs/{numero}`                                                                        | admin                                                              | admin                                                                          |
| `auditLog/{id}`                                                                               | admin                                                              | solo `create` por admin; inmutable                                             |

Todo lo demás está denegado.

## Colecciones

### `admins/{uid}`

Marca de admin. Campos permitidos: `email`, `createdAt` y `grantedBy` (uid de quien dio el rol). Un admin los crea y elimina desde Admin → Usuarios; el admin fijo (`crsuchema@gmail.com`) no necesita documento y no se le puede quitar el rol. Ya no hay que crear el primer documento a mano.

### `users/{uid}`

Perfil y datos del cliente con Google. Contiene correo, por eso solo lo lee el dueño o un admin.

| Campo         | Tipo         | Notas                                                                                        |
| ------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `displayName` | string ≤ 100 |                                                                                              |
| `email`       | string ≤ 200 | debe coincidir con el correo del token                                                       |
| `photoURL`    | string ≤ 500 |                                                                                              |
| `lastLoginAt` | timestamp    |                                                                                              |
| `cart`        | list ≤ 50    | líneas del carrito (subtarea 7); cada línea puede llevar `variantId` (sin él = versión base) |
| `wishlist`    | list ≤ 200   | IDs de producto (subtarea 7)                                                                 |

### `sections/{id}`

`name` (string), `slug` (string), `parentId` (string o `null`), `order` (number), `visible` (bool).

### `tags/{id}`

`name` (string), `aliases` (list de strings normalizados).

### `products/{id}`

| Campo                    | Tipo            | Notas                                                                                                    |
| ------------------------ | --------------- | -------------------------------------------------------------------------------------------------------- |
| `name`, `description`    | string          |                                                                                                          |
| `price`                  | number          | CRC                                                                                                      |
| `sectionIds`             | list de string  |                                                                                                          |
| `tagIds`                 | list de string  |                                                                                                          |
| `images`                 | list de string  | IDs de archivo de Drive, en orden                                                                        |
| `patchGroupIds`          | list de string  |                                                                                                          |
| `competitionIds`         | list de string  | competiciones que ofrece para nombre y número                                                            |
| `sizeSurcharges`         | map talla → CRC | solo las tallas que cambian el estándar (`settings/sizeSurcharges`); ej. `{ "3XL": 3000 }`               |
| `personalization`        | map             | `enabled` (bool), `surcharge` (number, opcional: si falta se usa el recargo estándar de personalización) |
| `sale`                   | map o `null`    | `price`, `startsAt`, `endsAt`, `countdown` (bool); aplica **solo a la versión base**                     |
| `baseVariantName`        | string          | opcional; nombre de la versión base en el selector ("Estándar" si falta)                                 |
| `sizes`                  | list de string  | opcional; tallas visibles de la versión base, en orden. Si falta, todas las estándar (`SIZES`, S a 4XL)  |
| `variants`               | list de map     | opcional; versiones de la camisa (ver abajo)                                                             |
| `visible`                | bool            | requerido                                                                                                |
| `deleted`                | bool            | requerido (soft delete)                                                                                  |
| `createdAt`, `updatedAt` | timestamp       |                                                                                                          |

#### Versiones: `products/{id}.variants[]`

Una camisa puede ofrecer versiones (Hombre / Mujer / Niño / edición especial…) en una sola tarjeta de catálogo; reseñas y lista de deseos siguen siendo por camisa. La **versión base** es la camisa misma (campos de arriba); `variants[]` son las demás. Cada elemento:

`{ id, name, visible, price?, images?, sizes?, sizeSurcharges?, patchGroupIds?, personalization?, sizeChartId?, sale? }`

- **Herencia:** una versión solo guarda lo que cambia; lo que no define lo hereda de la camisa base (`resolveVariant(product, variantId)` en `src/features/catalog/variants.js` devuelve una "vista" con la forma de un producto, para reutilizar `unitPrice` y `effectivePrice`). Una lista `images` vacía también hereda la de la base; `sizes` es la excepción (ver abajo).
- **Las ofertas NO se heredan:** `product.sale` aplica solo a la versión base y cada versión usa únicamente su propio `sale` (misma forma que el de la camisa, con `Timestamp` en `startsAt`/`endsAt`). Una versión sin `sale` se vende a su precio normal aunque la base esté en oferta. Se editan en Admin → Ofertas, que elige el alcance (base o una versión) por camisa.
- **Tallas:** `sizes` de una versión es la lista que ve el cliente (un subconjunto de las estándar, p. ej. mujer S a XL, o tallas propias, p. ej. niño `16, 18, …, 28`). **No se hereda** de la base: sin `sizes` la versión ofrece todas las estándar. Nunca puede quedar vacía. El recargo de una talla se busca por nombre: versión → camisa → estándar (`settings/sizeSurcharges`) → 0 (las tallas de niño no están en ningún mapa, así que valen 0).
- Una versión con `visible: false` no se ofrece; las líneas de carrito que la usaban quedan "no disponibles".
- **Catálogo y SEO:** la tarjeta muestra "desde ₡X" (precio vigente mínimo entre la base y las versiones visibles) cuando esos precios difieren; filtro y orden por precio usan ese mínimo; la descripción Open Graph dice "Desde ₡X" si varía. La portada es siempre la primera imagen de la camisa base.
- Sin `variants` (o sin `variantId` en una línea) todo se comporta como antes de existir las versiones.

### `productPrivate/{id}`

`cost` (number, CRC) y `margin` (number). Mismo `id` que el producto. `variantCosts` (map `{ [variantId]: costo }`, opcional) guarda el costo del proveedor de cada versión; si una versión no tiene costo propio se usa `cost`. Las reglas no validan la forma de `products` ni de `productPrivate`, así que las versiones no requirieron cambios en `firestore.rules`.

El documento especial `productPrivate/_defaults` (solo `cost`) guarda el costo del proveedor por defecto que se propone al crear camisas nuevas; no corresponde a ningún producto. Su contraparte pública, el precio base por defecto, vive en `settings/sizeSurcharges.basePrice` (`settings` es de lectura pública, por eso el costo no puede ir ahí). Ambos se editan en Admin → Predeterminados › Recargos.

### `patchGroups/{id}`

`name`, `image` (ID de Drive, opcional), `order`, `options`: lista de `{ name, image (ID de Drive), price (CRC) }`. Se crean desde el formulario de la camisa (modal); se editan o eliminan en Admin → Predeterminados › Parches.

### `competitions/{id}`

`name`, `order`. Se mantienen en Admin → Predeterminados › Competiciones. Cada camisa elige cuáles ofrece (`competitionIds`); el cliente escoge una al personalizar y su **nombre** se guarda en `custom.competition` de la línea del pedido.

### `sizeCharts/{id}`

Una categoría por documento: `name` (ej. Hombre, Mujer, Niño), `note` (texto opcional bajo la tabla), `order`, `measures` (nombres de las medidas, ej. Ancho (pecho), Largo) y `rows`: lista de `{ size, values }` donde `values` sigue el orden de `measures`. Las medidas se guardan siempre en cm (número o null); la app convierte a pulgadas al mostrar.

### `coupons/{code}`

El ID es el código en mayúsculas, sin tildes y solo con letras, números, guion y guion bajo (máx. 40).

| Campo                | Tipo                    | Notas                                                                                           |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `type`               | `'percent'` o `'fixed'` |                                                                                                 |
| `value`              | number                  |                                                                                                 |
| `scope`              | map                     | `{ type: 'all' \| 'sections' \| 'products', ids: [] }`; las secciones incluyen sus subsecciones |
| `minSubtotal`        | number                  |                                                                                                 |
| `startsAt`, `endsAt` | timestamp               | requeridos para registrar usos                                                                  |
| `active`             | bool                    |                                                                                                 |
| `maxUses`            | number                  | `0` = ilimitado                                                                                 |
| `usedCount`          | number                  |                                                                                                 |
| `lastOrderId`        | string                  | pedido que registró el último uso                                                               |

### `orders/{id}`

El ID es aleatorio y largo (generado por el cliente con `doc(collection(...))`).

| Campo                                       | Tipo                       | Notas                                                                                                                                                                                                                                                      |
| ------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uid`                                       | string                     | dueño; es el uid de la sesión (anónima o Google)                                                                                                                                                                                                           |
| `trackingCode`                              | string 20–64               | código no adivinable; es el ID de `orderTracking`                                                                                                                                                                                                          |
| `customer`                                  | map                        | `name`, `phone`, `email`, `address` (`province`, `canton`, `district`, `details`)                                                                                                                                                                          |
| `customerNote`                              | string ≤ 500               | opcional                                                                                                                                                                                                                                                   |
| `shippingMethod`                            | `'correos'` o `'whatsapp'` |                                                                                                                                                                                                                                                            |
| `lines`                                     | list 1–30                  | cada línea: `{productId, variantId?, name, size, patches[{group,name,price}], custom{name,number,competition?}\|null, qty, unitPrice}`; `variantId` solo existe si la línea es de una versión distinta de la base, y entonces `name` es "Camisa · Versión" |
| `subtotal`, `discount`, `shipping`, `total` | number                     | `total = subtotal − discount + shipping`                                                                                                                                                                                                                   |
| `couponCode`                                | string ≤ 40                | opcional                                                                                                                                                                                                                                                   |
| `advanceRequired`                           | number                     | ≥ `ceil(total × advancePercent / 100)` y ≤ `total`                                                                                                                                                                                                         |
| `receiptFileId`                             | string ≤ 100               | ID de Drive (carpeta privada)                                                                                                                                                                                                                              |
| `status`                                    | enum                       | inicial `pago_pendiente_revision`                                                                                                                                                                                                                          |
| `paidAmount`                                | number                     | inicial `0`                                                                                                                                                                                                                                                |
| `payments`                                  | list                       | inicial vacía; el admin agrega `{amount, ref, at}` al comprobar un pago; al entregar suma `method` (`efectivo`, `sinpe`, `tarjeta`)                                                                                                                        |
| `deleted`                                   | bool                       | inicial `false`                                                                                                                                                                                                                                            |
| `createdAt`                                 | timestamp                  |                                                                                                                                                                                                                                                            |

Estados: `pago_pendiente_revision`, `adelanto_confirmado`, `pedido_al_proveedor`, `en_camino`, `listo_para_entrega`, `entregado`, `cancelado`, `pago_rechazado`. La entrega (`/admin/entrega`) lee el QR del recibo `SCFC:<orderId>` (un QR para todo el pedido; el formato viejo `SCFC:<orderId>:<n>` se sigue leyendo) y cierra el pedido en `entregado` con un solo lote (orden, pago, `paymentRefs` si SINPE, rastreo y bitácora).

### `orderPrivate/{id}`

Datos internos del pedido (notas internas del admin). Mismo `id` que `orders`. Va aparte porque las reglas aplican a todo el documento y el cliente lee su pedido.

### `printJobs/{id}`

Recibo en imagen que el admin deja para imprimirlo con PuraPrint cuando la app corre como PWA instalada (donde no hay `postMessage` entre ventanas). PuraPrint lo lee por su ID, que no es adivinable (`?job=<id>&src=suchema`). Campos: `image` (`data:image/png;base64,…`, máx. 400 000 caracteres), `title` (máx. 100), `orderId`, `createdAt` (= hora del servidor). Se borran al eliminar el pedido.

### `orderTracking/{code}`

Vista pública mínima, sin datos personales.

| Campo                    | Tipo                                |
| ------------------------ | ----------------------------------- |
| `orderId`                | string                              |
| `status`                 | enum (igual que `orders.status`)    |
| `timeline`               | list ≤ 30 de `{ status, at, note }` |
| `summary`                | list ≤ 30 de `{ name, size, qty }`  |
| `estimatedDate`          | timestamp o `null`                  |
| `createdAt`, `updatedAt` | timestamp                           |

### `supplierOrders/{id}`

`supplier`, `notes`, `status` (`pedido`, `en_produccion`, `enviado`, `llego`), `lineRefs` (`[{orderId, lineIndex}]`), `items` (copia de cada línea con `orderRef`, `name`, `size`, `patches`, `custom`, `qty`, `unitCost`, `unitPrice` precio de venta de la línea), `totalCost` (solo camisas), `importCost` (costos de importación del pedido; se reparten en partes iguales entre las camisas), `estimatedDate` (timestamp o `null`), `updates` (`[{status, at, note}]`), `createdAt`. Solo admin. Cambiar el estado actualiza en el mismo lote `orders.status` y `orderTracking` (estado, historial y `estimatedDate`) de los clientes afectados.

### `expenses/{id}`

Costos secundarios (insumos como papel de impresora o bolsas): `description` (texto, 1–100), `amount` (entero > 0), `date` (timestamp), `createdAt`. Solo admin; se crean y se eliminan, no se editan. Restan de la ganancia en Admin → Resumen.

### `reviews/{productId_uid}`

El ID obliga a una reseña por usuario y producto. `get`: el dueño puede consultar su reseña aunque aún no exista; `list`: solo aprobadas, propias o admin (la app consulta por `productId` + `approved == true`). El admin solo puede cambiar `approved` (moderación en `/admin/resenas`).

| Campo        | Tipo          | Notas                               |
| ------------ | ------------- | ----------------------------------- |
| `productId`  | string        | debe existir                        |
| `uid`        | string        |                                     |
| `authorName` | string        | igual al nombre del token de Google |
| `rating`     | int 1–5       |                                     |
| `text`       | string ≤ 1000 |                                     |
| `photos`     | list ≤ 4      | IDs de Drive                        |
| `approved`   | bool          | `false` al crear                    |
| `createdAt`  | timestamp     |                                     |

### `settings/{doc}`

Documentos: `sizeSurcharges` (`values`: map talla → CRC con los recargos estándar por talla, y `personalization`: recargo estándar de nombre y número; se editan en Admin → Predeterminados › Recargos y cada camisa puede sobrescribirlos), `general` (`whatsappNumber`, solo dígitos; plazo del proveedor), `payment` (**`advancePercent`**, obligatorio para poder crear pedidos), `shipping` (`correosEnabled`, `correosFee`, `correosText`, `whatsappEnabled`, `whatsappText`), `content` (`howToBuy`, `faq` [`{q, a}`], `shipping`, `returns`, `terms`, `whatsappMessage`, `leadDays`; texto simple con marcadores `{adelanto}`, `{plazo}` y `{tarifa}`; se edita en Admin → Contenido). Se editan desde Admin → Ajustes (`saveStoreSettings`).

### `paymentMethods/{id}`

`type` (ej. `sinpe`), `number`, `holder`, `notes`, `order`, `visible`. Se gestionan desde Admin → Ajustes.

### `paymentRefs/{numero}`

Unicidad de comprobantes: el ID es el número de comprobante (mayúsculas, sin espacios). Campos: `orderId`, `amount`, `createdAt`. Las reglas solo permiten `create` y `delete` (no `update`), así que registrar dos veces el mismo número falla aunque dos admins lo intenten a la vez.

### `auditLog/{id}`

`actorUid`, `action`, `collection`, `docId`, `summary`, `createdAt`. Solo se crea, nunca se modifica.

## Limitaciones de Spark (sin Functions)

1. **Precios en pedidos:** las reglas validan forma, rangos, la aritmética de los totales y el porcentaje de adelanto, pero no pueden recorrer `lines` para recalcular precios contra el catálogo. El admin revisa cada pedido antes de confirmar el adelanto.
2. **Cupones:** el uso solo se puede registrar sumando 1 a `usedCount` junto con un pedido nuevo del mismo usuario que lleve ese cupón. Aun así, un cliente puede crear un pedido con un descuento que no corresponde; también lo detecta la revisión manual. Cupones de un solo uso por cliente no se pueden garantizar.
3. **Contenido de listas:** las reglas limitan el tamaño de `cart`, `wishlist` y `lines`, pero no validan cada elemento. El límite de 1 MiB por documento acota el daño.
4. **Rastreo:** la seguridad de `orderTracking` depende de que el código sea largo y aleatorio (mínimo 20 caracteres). No debe generarse con valores predecibles.
5. **Estado `orderTracking`:** solo lo actualiza el admin; el cliente no puede modificarlo.
6. **Spam de pedidos:** cualquier sesión anónima puede crear pedidos válidos y no hay límite por usuario. Se mitiga con la revisión manual (un pedido sin adelanto confirmado no avanza) y, si hiciera falta, con App Check (fuera del alcance actual).
7. **Prerrequisitos de datos:** crear pedidos exige que existan `settings/payment` con `advancePercent` (número) y, para cupones, `startsAt`, `endsAt`, `active`, `maxUses` y `usedCount` en el cupón. Si falta alguno, la regla falla cerrada (el pedido se rechaza).
8. **Sesión anónima y admin:** un admin solo se reconoce con sesión de Google; el mismo uid con sesión anónima no tiene privilegios.
