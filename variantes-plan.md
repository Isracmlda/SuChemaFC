# Plan: versiones (variantes) dentro de una misma camisa

## Visión general

Hoy una camisa (`products/{id}`) tiene un solo precio, un solo juego de fotos, una sola lista de tallas
(`SIZES` = S…4XL), un solo recargo por talla y un solo conjunto de parches. Para vender "Hombre / Mujer /
Niño / Edición con patrocinador especial" hoy habría que crear productos separados.

**Objetivo:** que una camisa tenga una lista opcional de **versiones**. El catálogo muestra una sola tarjeta,
las reseñas y la lista de deseos son compartidas, y cada versión puede cambiar lo que necesite.

**Decisiones confirmadas por el usuario**

- Una versión puede cambiar: fotos, precio, tallas, tabla de tallas, parches, personalización, **costo del
  proveedor y oferta propios**.
- Con varias unidades ("Camisa 1", "Camisa 2"…), **cada camisa elige su propia versión y su propia talla**.
- **Cada versión decide qué tallas ve el cliente.** Puede mostrar solo parte de las estándar (mujer: S, M, L
  y XL, sin 2XL a 4XL) o usar tallas propias (niño: `16, 18, 20, 22, 24, 26, 28`, **sin ningún recargo**).
  Esto también aplica a la versión base de la camisa.

**Regla de herencia (idea central).** Una versión solo guarda lo que cambia; lo que no define lo hereda de
la camisa base. Una función pura `resolveVariant(product, variantId)` devuelve una "vista" con la misma
forma que un producto (precio, imágenes, parches, recargos, personalización, oferta). Así
`unitPrice`, `effectivePrice` y el resto de la lógica existente se reutilizan sin reescribirse.

Casos de herencia a respetar:

- **Ofertas no se heredan.** La oferta (`sale`) de la camisa base aplica solo a la versión base. Cada versión
  usa únicamente su propia `sale`; si no tiene, se vende a su precio normal (decisión del usuario).
- La **versión base** (la camisa tal como está hoy) es la primera opción del selector. Su nombre se guarda
  en `baseVariantName` (campo nuevo en el producto; si falta, se muestra "Estándar"). Una línea sin
  `variantId` corresponde a la versión base.
- **Tallas visibles.** `sizes` es la lista de tallas que se ofrecen, en el orden en que se muestran. Si no
  se define, se ofrecen todas las estándar (`SIZES`, S a 4XL). Una versión puede marcar un subconjunto de las
  estándar o escribir tallas propias. Nunca puede quedar vacía (se valida al guardar).
- **Recargo de una talla** se busca por nombre: recargo propio de la versión → recargo de la camisa →
  recargo estándar de la tienda → 0. Las tallas de niño (16 a 28) no están en ningún mapa de recargos, así
  que valen 0 sin configurar nada, y las estándar que mujer conserve (S a XL) mantienen su recargo habitual.
- Sin versiones o sin `variantId` en una línea vieja = se comporta exactamente como hoy (compatibilidad con
  carritos y pedidos existentes).

**Datos nuevos (sin cambios en `firestore.rules`)**

- `products/{id}.baseVariantName` (texto, opcional), `products/{id}.sizes` (tallas visibles de la versión
  base, opcional) y `products/{id}.variants[]`: `{ id, name, visible, price?, images?, sizes?,
sizeSurcharges?, patchGroupIds?, personalization?, sizeChartId?, sale? }`.
- `productPrivate/{id}.variantCosts`: `{ [variantId]: costo }` (el costo ya vive aquí por ser privado).
- Línea de carrito y de pedido: `variantId` opcional. En el pedido, `name` pasa a ser
  "Nombre de camisa · Nombre de versión", para que proveedor, entregas, recibos, rastreo y WhatsApp
  muestren la versión sin tocarlos.
- Las reglas hoy no validan la forma de `products`, ni de `orders.lines` (solo cantidad 1–30) ni de
  `users.cart` (solo tamaño ≤ 50), por lo que no se necesitan cambios.

**Fuera de alcance**

- Reseñas por versión (se mantienen por camisa).
- Inventario o stock por versión (no existe hoy en el proyecto).
- Migración de productos ya existentes que estén separados (se pueden fusionar a mano después).

---

## Sub-tareas

### 1. Modelo y lógica pura de versiones

- **Intent:** tener la base de datos y de cálculo que usarán todas las demás tareas, con pruebas.
- **Expected Outcomes:**
  - `resolveVariant` devuelve la camisa "efectiva" de una versión aplicando la regla de herencia.
  - Helpers: lista de versiones visibles, tallas visibles de una versión, precio mínimo ("desde"), y si un
    producto tiene versiones.
  - Una versión con `sizes` solo ofrece esas tallas (ej. mujer hasta XL); sin `sizes`, ofrece S a 4XL.
  - `unitPrice` y `effectivePrice` dan el resultado correcto al recibir la vista de una versión.
  - Producto sin versiones se comporta igual que hoy.
- **Todo List:**
  1. Crear módulo de versiones en `src/features/catalog/` (o `pricing/`) con `resolveVariant`,
     `visibleVariants`, `variantSizes`, `minVariantPrice`.
  2. `SIZES` queda como lista por defecto; las tallas de cada versión (subconjunto o propias) son dato de
     la versión, no constante global.
  3. Cambiar `isValidSize` para validar contra las tallas visibles de la versión, no contra `SIZES`.
  4. Que `sizeSurcharge` busque por nombre de talla en el orden: versión → camisa → estándar → 0.
  5. Agregar pruebas: herencia, subconjunto (mujer hasta XL), tallas propias sin recargo (niño), talla no
     ofrecida por la versión, versión oculta, id inexistente, producto sin versiones.
- **Relevant Context:** `src/features/pricing/price.js` (`unitPrice`, `sizeSurcharge`, `isValidSize`),
  `src/features/catalog/search.js` (`effectivePrice`, `isSaleActive`), `src/utils/constants.js` (`SIZES`),
  `tests/catalog.test.js`, `tests/promotions.test.js`.
- **Status:** `[x] done`
- **Notas para la sub-tarea 2 (lo que quedó implementado):**
  - Módulo nuevo `src/features/catalog/variants.js` (puro) exporta: `visibleVariants(product)`,
    `hasVariants(product)`, `findVariant(product, variantId)` (null si vacío/inexistente/oculta),
    `variantSizes(product, variantId)` (`[]` si la versión no es resoluble), `resolveVariant(product,
variantId)` (null si oculta/inexistente; sin `variantId` devuelve la vista base),
    `minVariantPrice(product, now)` y `DEFAULT_BASE_VARIANT_NAME` ("Estándar").
  - La vista de `resolveVariant` es un producto sin `variants` más `variantId` (null en la base),
    `variantName` (usar para mostrar en carrito/pedido) y `sizes` (tallas visibles). Se le puede pasar
    directo a `unitPrice`/`effectivePrice`. `sale` no se hereda (solo la base la conserva).
  - `src/features/pricing/price.js`: `sizeSurcharge(product, size, standard, variantId = null)` (con
    `variantId` resuelve la versión; si no es resoluble devuelve 0) y `isValidSize(size, product?,
variantId = null)` (sin `product` valida contra `SIZES`, como antes). `unitPrice` no cambió: en
    `priceCart` conviene hacer `unitPrice(resolveVariant(product, line.variantId), groups, selection, ...)`
    y marcar `unavailable` si `resolveVariant` devuelve null o `isValidSize(size, product, variantId)` es false.
  - Pendiente para sub-tareas siguientes: `patchGroupIds` de la vista ya refleja el de la versión
    (`cart.js` línea ~131 lee `product.patchGroupIds`, así que pasarle la vista basta).
  - Pruebas en `tests/variants.test.js` (24). `package.json` no tiene script `npm test`: se usa
    `npx vitest run` (`tests/firestore.rules.test.js` requiere emulador: `npm run test:rules`).

### 2. Carrito y pedido con `variantId`

- **Intent:** que la compra recuerde qué versión se eligió y que el precio se recalcule con ella.
- **Expected Outcomes:**
  - Dos líneas de la misma camisa pero distinta versión no se mezclan.
  - `priceCart` calcula con la versión; si la versión se oculta o elimina, la línea queda `unavailable`.
  - El pedido guarda `variantId` y `name` con la versión; el rastreo, proveedor, entregas y recibos la
    muestran sin cambios adicionales.
  - Carritos y pedidos antiguos (sin `variantId`) siguen funcionando.
- **Todo List:**
  1. Incluir `variantId` en `lineKey`, `makeLine`, `sanitizeLines` (cart.js).
  2. En `priceCart`, resolver la versión, calcular el precio con su vista y marcar no disponible si
     falta o está oculta; devolver el nombre de la versión para mostrarla en Cart.
  3. En `buildOrderLines`, guardar `variantId` y componer `name` con la versión.
  4. Mostrar la versión en `Cart.jsx` y en el resumen de checkout.
  5. Proveedor: incluir `variantId` en las líneas pendientes y en la clave de agrupación de
     `groupLines` para no mezclar versiones con la misma talla (ej. M de hombre y M de mujer).
  6. Dashboard: calcular costo/margen por `productId + variantId` cuando exista `variantCosts`.
  7. Pruebas de `cart`, `checkout`, `supplier` y `dashboard`.
- **Relevant Context:** `src/features/cart/cart.js`, `src/features/checkout/checkout.js`
  (`buildOrderLines`, `buildTrackingSummary`), `src/pages/Cart.jsx`, `src/pages/Checkout.jsx`,
  `src/features/admin/supplier/supplier.js`, `src/features/admin/dashboard/stats.js`,
  `src/services/reports.js` (lee `productPrivate`), `tests/cart.test.js`, `tests/checkout.test.js`,
  `tests/supplier.test.js`, `tests/dashboard.test.js`.
- **Status:** `[x] done`
- **Notas para la sub-tarea 3 y 4 (lo que quedó implementado):**
  - `src/features/cart/cart.js`: `lineKey`/`makeLine` aceptan `variantId`. La llave solo añade el
    segmento `|v:<id>` al final si hay versión, así que las líneas sin `variantId` (o `''`/`null`) conservan
    la llave de siempre (`p1|M||`). `makeLine` solo incluye la clave `variantId` si existe; un `variantId`
    que no sea texto se ignora. Para agregar al carrito desde `Product.jsx` basta pasar `variantId` a
    `makeLine` (la versión base va sin `variantId`) y `addLine` junta las idénticas.
  - `priceCart`: usa `resolveVariant(product, line.variantId)` y `isValidSize(size, product, variantId)`;
    si la versión no existe/está oculta o la talla ya no se ofrece, el ítem es `unavailable` (con `product`
    y `variantName: null`; Cart.jsx lo muestra con el mensaje genérico). Cada ítem `ok` trae `variantName`
    (nombre de la versión; `null` en la versión base, que no se muestra). Los parches se leen de
    `view.patchGroupIds` y el precio sale de `unitPrice(view, ...)`, con lo que la oferta de la versión
    aplica y la de la base no se hereda.
  - `buildOrderLines`: guarda `variantId` solo si existe y `name = "Camisa · Versión"` (la base no cambia).
    El mensaje de WhatsApp y `buildTrackingSummary` ya usan `name`, sin cambios. Cart.jsx y el resumen de
    Checkout.jsx muestran la versión desde `item.variantName`.
  - Proveedor: `pendingLines` incluye `variantId` (`null` si no hay) y `groupLines` lo usa en la clave
    (`producto|versión|talla`; sin versión queda `producto|talla` como antes). Nuevo helper
    `defaultUnitCost(line, costs, variantCosts)` (costo de la versión → costo de la camisa → 0); `SupplierPage`
    ya carga `variantCosts` de `productPrivate`.
  - Dashboard: `productReport(orders, costs, variantCosts = {})` y `summarize(orders, costs, variantCosts)`.
    Las filas son por `productId + variantId` (nuevo campo `key`; la clave de React del dashboard usa `key`).
    El costo es `variantCosts[productId][variantId]` y, si falta, el de la camisa. El formato esperado de
    `productPrivate/{id}.variantCosts` es `{ [variantId]: costo }`. `services/reports.js` añade
    `loadCostData()` -> `{ costs, variantCosts }` (`loadCosts()` se mantiene para el respaldo del catálogo).
    Pendiente (sub-tarea 3): `saveProduct` debe escribir `variantCosts` en `productPrivate`; el CSV de
    catálogo/respaldo (`catalogCsv`) aún exporta solo el costo base.
  - Pruebas ampliadas en `tests/cart.test.js`, `checkout`, `supplier` y `dashboard` (257 en total pasan con
    `npx vitest run --exclude tests/firestore.rules.test.js`). Eslint, prettier y `npm run build` limpios.

### 3. Admin: editar versiones en el formulario de camisa

- **Intent:** que el administrador cree y edite versiones sin salir de la camisa.
- **Expected Outcomes:**
  - Tarjeta plegable "Versiones" en `ProductForm` para agregar, nombrar, ordenar, ocultar y quitar
    versiones.
  - Cada versión permite sobrescribir precio, costo del proveedor, fotos, tallas visibles y sus recargos,
    parches, personalización y tabla de tallas; lo vacío significa "usa el de la camisa".
  - Selector de tallas visibles por versión (y también para la versión base): casillas con las tallas
    estándar S a 4XL para marcar cuáles se muestran, más un campo para añadir tallas propias (ej. 16, 18…).
    Las tallas propias se ordenan en el orden en que se escriben.
  - `saveProduct` guarda `variants` y `variantCosts` en el mismo lote con bitácora.
  - El margen de cada versión se muestra igual que el de la camisa base.
- **Todo List:**
  1. Componente `VariantEditor`, reutilizando lo ya existente (`Field`, `NumberInput`, `ImageUploader`,
     `CheckList`, `CollapsibleCard`) y el patrón del carrusel de imágenes.
  2. Extraer del formulario actual lo que se repita (editor de imágenes ordenables, de recargos por
     talla) en piezas reutilizables, sin cambiar su comportamiento.
  3. Validar en el formulario: nombre de versión único y obligatorio, al menos una talla visible, tallas
     sin duplicados (sin distinguir mayúsculas), precios enteros ≥ 0.
  4. Ampliar `saveProduct` con `variants` y `variantCosts`; no tocar `sale` del producto en edición.
  5. Para tabla de tallas por versión, pedir `sizeChartId` y validarlo contra `sizeCharts`.
- **Relevant Context:** `src/features/admin/catalog/ProductForm.jsx` (EMPTY ~línea 24, bloque de tallas
  ~línea 505), `src/services/catalog.js` (`saveProduct` ~línea 333), `src/components/*`.
- **Status:** `[x] done`
- **Notas para la sub-tarea 4 (lo que quedó implementado):**
  - Módulo puro `src/features/admin/catalog/productAdmin.js`: `makeVariantId()`, `parseCustomSizes(text)`,
    `normalizeSizes(sizes)`, `areSizesStandard(sizes)`, `validateSizes(sizes, label)`,
    `validateVariants(variants, sizeChartIds)`, `cleanVariantForSave(variant, existingVariant)`,
    `cleanVariantCosts(variants, variantCosts)`.
  - Componentes reutilizables:
    - `src/features/admin/catalog/ImagesEditor.jsx`: carrusel de imágenes ordenables con DriveImage y subida múltiple.
    - `src/features/admin/catalog/SizeSurchargesEditor.jsx`: recargos por talla con comparación contra estándar.
    - `src/features/admin/catalog/VisibleSizesEditor.jsx`: selector de tallas visibles (S…4XL + tallas propias dinámicas),
      con soporte de herencia (`allowInherit`).
    - `src/features/admin/catalog/VariantEditor.jsx`: edición completa de versión (nombre, visibilidad, precio, costo,
      margen en tiempo real, tabla de tallas `sizeChartId`, tallas visibles, recargos de talla, fotos propias,
      parches propios y personalización propia).
  - `ProductForm.jsx`: nueva tarjeta plegable "Versiones", campo `baseVariantName` en la tarjeta de descripción,
    selector de tallas visibles base en "Tallas y recargos", y cálculo del margen de la base y de cada versión.
  - `src/services/catalog.js`: `saveProduct(product, cost, variantCosts = {})` guarda `baseVariantName`, `sizes`,
    `variants` (limpios sin campos vacíos y preservando `sale`) y `variantCosts` en `productPrivate` en lote con bitácora.
  - Respaldo y CSV (`src/features/admin/dashboard/exports.js`, `BackupPage.jsx`): `catalogCsv` exporta filas con nombre
    compuesto (`Camisa · Versión`), precio y costo privado por versión cuando la camisa tiene versiones, manteniendo
    el formato de siempre para camisas sin versiones. El JSON de respaldo incluye `variantCosts` cuando existe.
  - Pruebas en `tests/productAdmin.test.js` y `tests/dashboard.test.js` (276 pruebas pasan).

### 4. Página de la camisa: versión y talla por cada camisa

- **Intent:** que el cliente elija versión y talla para cada unidad que compra.
- **Expected Outcomes:**
  - Si la camisa tiene versiones visibles, aparece un selector "Versión" sobre la talla; si no tiene,
    la página se ve igual que hoy.
  - Al cambiar de versión se actualizan galería, precio, tallas (niño: 16–28), parches, personalización
    y la guía de tallas preseleccionada en la tabla de esa versión.
  - La talla, la versión, los parches y el nombre/número son independientes por cada "Camisa N".
  - El total suma el precio de cada camisa con su versión; el botón no se activa hasta que todas
    tengan talla.
  - Al cambiar de versión se limpian parches y personalización que ya no apliquen.
- **Todo List:**
  1. Mover `size` al estado por camisa (`shirts[i]`) junto con `variantId`.
  2. Selector de versión y lista de tallas dinámica según la versión activa.
  3. La galería sigue la versión de la camisa activa.
  4. `SizeGuide` acepta una categoría inicial (`sizeChartId`) manteniendo el dropdown.
  5. Mostrar la oferta (`SaleCountdown`) y el precio tachado de la versión activa.
  6. Al agregar al carrito, armar líneas con `variantId` y juntar idénticas (ya se hace con `addLine`).
- **Relevant Context:** `src/pages/Product.jsx` (`Gallery`, `Purchase`, `blankShirt`),
  `src/features/sizeChart/SizeGuide.jsx`, `src/features/pricing/SaleCountdown.jsx`.
- **Status:** `[x] done`
- **Notas para la sub-tarea 5 (lo que quedó implementado):**
  - Módulo puro nuevo `src/features/catalog/shirts.js`: `blankShirt()` (`{ variantId: null, size: '', patches: {},
custom }`), `shirtView`, `patchGroupsFor`, `changeShirtVariant` (limpia talla no ofrecida, parches de grupos
    que la versión no usa y personalización si la versión no la permite), `shirtChipLabel` ("Camisa 2 · Niño · 16"),
    `shirtInfo`, `summarizeShirts` (`infos`, `total`, `sameUnit`, `missingSize`, `canAdd`) y `buildShirtLines`
    (líneas con `variantId` solo si no es la base, juntando idénticas con `addLine`). Pruebas en
    `tests/shirts.test.js` (18); 294 pasan con `npx vitest run --exclude tests/firestore.rules.test.js`.
  - `src/pages/Product.jsx`: el estado `shirts[]`/`active` ahora vive en el nuevo componente `ProductView`
    (`Product` solo carga y le pasa `product`/`catalog`); `Purchase` recibe ese estado. El selector "Camisa N"
    está arriba de versión, talla, parches y personalización. Sin versiones la página queda igual que antes.
  - Precio/oferta del encabezado, galería (`key` por versión, vuelve a la primera imagen) y `SizeGuide`
    (`initialChartId={view.sizeChartId}`, `key` por versión) usan la vista (`resolveVariant`) de la camisa activa.
    `SizeGuide` ahora acepta `initialChartId` opcional.
  - Para la sub-tarea 5: `ProductCard`, `filterProducts`/`sortProducts` y `buildProductMeta` siguen usando solo el
    precio/oferta de la base. Usar `minVariantPrice(product, now)` de `variants.js` (ya considera la base y las
    versiones visibles, y no hereda la oferta de la base). `buildProductMeta` y la página de producto aún muestran
    `product.images[0]` como portada (debe seguir siendo la de la base). `Product.jsx` no se tocó en SEO
    (`usePageMeta` sigue usando la descripción de `buildProductMeta`).

### 5. Catálogo, búsqueda y SEO con versiones

- **Intent:** que una camisa con versiones se vea y se encuentre bien en el catálogo.
- **Expected Outcomes:**
  - La tarjeta muestra "desde ₡X" cuando las versiones tienen precios distintos.
  - El filtro y orden por precio usan el precio mínimo vigente entre versiones visibles.
  - Los metadatos SEO usan el precio mínimo y no afirman un solo precio si varían.
  - La imagen de portada sigue siendo la de la camisa base.
- **Todo List:**
  1. Ajustar `ProductCard` para "desde".
  2. Usar el precio mínimo en `filterProducts`/`sortProducts`.
  3. Ajustar `buildProductMeta`.
  4. Pruebas en `catalog` y `seo`.
- **Relevant Context:** `src/features/catalog/ProductCard.jsx`, `src/features/catalog/search.js`,
  `src/features/seo/seo.js`, `tests/catalog.test.js`, `tests/seo.test.js`.
- **Status:** `[x] done`
- **Notas para la sub-tarea 6 y 7 (lo que quedó implementado):**
  - Nuevo módulo puro `src/features/catalog/salePrice.js` con `isSaleActive` y `effectivePrice` (rompe el ciclo
    `search.js` ↔ `variants.js` ↔ `price.js`). `search.js` los reexporta, así que los imports existentes siguen
    funcionando; `variants.js` y `price.js` importan de `salePrice.js`.
  - `variants.js`: nuevo `priceSummary(product, now)` → `{ min, from, onSale }` (`from` = los precios vigentes
    difieren → "desde"; `onSale` = la base o una versión visible tiene oferta vigente). `minVariantPrice` ahora
    delega en él.
  - `ProductCard`: muestra "desde ₡X" si `from`; el precio tachado solo se muestra cuando no hay "desde" y la
    base está en oferta; la insignia "Oferta" aparece si la base o alguna versión visible está en oferta.
    La portada sigue siendo `product.images[0]`. La lista de deseos y el catálogo usan `ProductCard`, así que
    heredan el cambio (no hay buscador/carrusel con precio propio).
  - `filterProducts`/`sortProducts` usan `minVariantPrice`.
  - `buildProductMeta(product, siteUrl, now = Date.now())`: "Desde ₡X" si varía; no existe JSON-LD/offers en el
    proyecto (solo `<meta>` y Open Graph), así que no hubo nada más que ajustar. El prerender
    (`scripts/prerender.mjs`) sigue funcionando: `variants[]` llega decodificado por `firestoreRest.js`
    (arreglos/mapas), con fechas de `sale` como milisegundos.
  - Pruebas en `tests/catalog.test.js` (4) y `tests/seo.test.js` (2); 300 pasan.

### 6. Ofertas por versión

- **Intent:** permitir una oferta distinta en cada versión, como se pidió.
- **Expected Outcomes:**
  - Cada versión puede tener su `sale` con la misma forma que la del producto.
  - En administración de ofertas se elige si se aplica a toda la camisa o a una versión concreta.
  - La oferta de la camisa base **no** se hereda: aplica solo a la versión base. Las versiones sin
    oferta propia se venden a su precio normal.
- **Todo List:**
  1. Extender `applySales` para escribir `variants[i].sale` además de `sale` de la camisa.
  2. Ajustar `SalesPage` para elegir el alcance (camisa o versión) y mostrar el estado por versión.
  3. Normalizar fechas de `variants[].sale` en `storefront.js` como ya se hace con `sale`.
  4. Pruebas de `promotions`.
- **Relevant Context:** `src/services/promotions.js` (`applySales` ~línea 117),
  `src/features/admin/promotions/SalesPage.jsx`, `src/features/pricing/sale.js`,
  `src/services/storefront.js` (~línea 15).
- **Status:** `[x] done`
- **Notas para la sub-tarea 7 (lo que quedó implementado):**
  - `src/features/pricing/sale.js` (puro): `normalizeSale(sale)` (Timestamp → ms), `saleScope(product, variantId)`
    (`{ price, sale }` de la base o de una versión, incluso oculta; null si no existe), `salePriceFor`/`buildSale`/
    `saleState` aceptan `variantId` opcional (la versión sin precio propio usa el de la base) y
    `saleUpdateFields(product, changes, convert)` arma los campos a escribir: solo `sale` si cambia la base; si
    cambia una versión, el arreglo `variants` completo clonado (solo cambia el `sale` indicado; el resto se
    conserva y `variants` no se toca cuando solo cambia la base).
  - `applySales(products, salesByProduct, label)`: cada valor del Map es `[{ variantId|null, sale|null }]`
    (también acepta un objeto `sale` suelto = base, por compatibilidad). Usa `ts()` para las fechas.
  - `storefront.js` `normalizeProduct`: normaliza con `toMillis` también `variants[].sale` (no añade `variants` si
    no existía).
  - `SalesPage`: cada camisa con versiones muestra la oferta de la base y de cada versión, y un selector
    "Base / Versión: X" (por defecto la base). **Comportamiento masivo:** a cada camisa seleccionada se le aplica
    o quita la oferta en el alcance que tenga elegido en su fila (por defecto la base); el porcentaje se calcula
    sobre el precio de ese alcance. El texto explicativo está en la propia pantalla. El filtro "Con oferta/Sin
    oferta" considera base y versiones.
  - Pruebas en `tests/promotions.test.js` (8 nuevas); 308 pasan.

### 7. Documentación y validación final

- **Intent:** dejar el modelo documentado y comprobar que nada se rompió.
- **Expected Outcomes:** `docs/data-model.md` describe `variants`, `variantCosts` y `variantId`; pruebas,
  lint y build pasan.
- **Todo List:**
  1. Actualizar `docs/data-model.md` y `docs/plan.md`.
  2. Ejecutar `npm test`, `npx eslint`, `npx prettier --check` y `npm run build`.
  3. Confirmar manualmente: camisa con 3 versiones, compra de 2 unidades con versiones distintas,
     visualización en carrito, pedido y panel de proveedor.
- **Relevant Context:** `docs/data-model.md`, `package.json` scripts.
- **Status:** `[x] done`
- **Notas finales:**
  - Documentado en `docs/data-model.md` (`baseVariantName`, `sizes`, `variants[]`, `variantCosts`, `variantId` en cart/pedido, herencia y ofertas no heredadas), `docs/plan.md` y `suchema-plan.md` (tabla de modelo + decisión cerrada). `firestore.rules` no se tocó.
  - Validación: `npx vitest run --exclude tests/firestore.rules.test.js` (314), `npx eslint .`, `npx prettier --check .`, `npm run build`, `check:contrast` y `check:brand` en verde. `tests/variantsFlow.test.js` cubre el flujo de 3 versiones y 2 unidades (carrito, pedido, rastreo, proveedor, dashboard, catálogo).
  - No verificado sin navegador/Firestore real: UI de `SalesPage` (selector de alcance), `ProductCard` visual, escritura real de `variants` con `Timestamp` y `npm run test:rules` (requiere emulador).

---

## Orden recomendado

1 → 2 → 3 → 4 → 5 → 6 → 7. Cada sub-tarea deja la app funcionando: sin versiones definidas, todo se ve
y se comporta como hoy.
