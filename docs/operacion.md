# Guía de operación, seguridad y despliegue

Documento para quien administra SuChemaFC. Los pasos marcados **[Tú]** requieren tus credenciales (consola de Firebase, Google, Drive) y no se pueden hacer desde el código.

## 1. Puesta en marcha (una sola vez)

1. **[Tú] Configurar `.env`:** `Copy-Item .env.example .env` y completar con la configuración web de Firebase, la URL del Web App de Apps Script (`VITE_APPS_SCRIPT_URL`) y, opcionalmente, un número de respaldo de WhatsApp.
2. **[Tú] Firebase Auth:** habilitar los proveedores **Google** y **Anónimo**; en _Dominios autorizados_ añadir `localhost` y el dominio de producción.
3. **[Tú] Apps Script:** seguir [`apps-script-setup.md`](apps-script-setup.md) (carpetas pública y privada de Drive, propiedades del script, implementación como aplicación web). Copiar la URL `/exec` a `VITE_APPS_SCRIPT_URL`.
4. **[Tú] Publicar las reglas:** `npx firebase-tools login` y luego `npx firebase-tools deploy --only firestore:rules,firestore:indexes`. **Hasta que se publiquen, la base de datos usa las reglas anteriores (de prueba).**
5. **Administradores:** `crsuchema@gmail.com` es admin fijo en cuanto inicia sesión con Google (no hay que crear nada en Firestore). Desde Admin → Usuarios puede dar o quitar el rol de admin a otras personas (que ya hayan entrado una vez), buscar por nombre o correo y eliminar usuarios.
6. **Ajustes iniciales** (en la app: Admin → Ajustes):
   - Porcentaje de adelanto (`settings/payment.advancePercent`, por defecto 50). Si el documento no existe, **las reglas rechazan todos los pedidos**: guarda los ajustes al menos una vez.
   - Tarifa de Correos y texto de envío.
   - Número de WhatsApp de la tienda.
   - Al menos un **método de pago** (SINPE con número y nombre).
7. **Contenido:** Admin → Contenido (preguntas frecuentes, términos, mensaje de WhatsApp).
8. **Catálogo:** Admin → Secciones, Parches, Competiciones, Recargos y Tallas; las camisas se agregan desde Inicio. Los **hashtags** se escriben directamente en el formulario de cada camisa (se crean solos). Los recargos por talla y por personalización son estándar (Admin → Recargos) y cada camisa puede cambiarlos. Una camisa solo aparece en la tienda si está **visible** y no eliminada.

## 2. Despliegue

```powershell
npm run lint; npm run format:check; npm run check:contrast; npm run check:brand
npm run test:rules          # necesita Java en el PATH (emulador de Firestore)
npm run deploy              # build + prerender + firebase deploy (hosting y reglas)
```

- `npm run prerender` lee las camisas visibles con la API REST de Firestore y genera `dist/p/<id>/index.html` (Open Graph por camisa), `sitemap.xml` y `robots.txt`. **Se debe repetir en cada despliegue** si cambió el catálogo; es manual por decisión de diseño. Con dominio propio: `$env:SITE_URL = 'https://midominio.com'` antes de ejecutarlo.
- El service worker (`sw.js`) se actualiza solo (`autoUpdate`): los clientes reciben la versión nueva en su siguiente visita.
- Cambios solo de reglas: `npx firebase-tools deploy --only firestore:rules`.

## 3. Flujo diario

| Paso                    | Dónde                       | Qué pasa                                                                                                                                                      |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compra como invitado    | Tienda → Carrito → Checkout | Sesión anónima (o Google). Se sube el comprobante SINPE a Drive y se crea `orders` + `orderTracking` en un solo lote. El cliente recibe un código de rastreo. |
| Revisión del pago       | Admin → Pedidos             | Ver comprobante, confirmar/rechazar pago. Estados: pago pendiente → adelanto confirmado → …                                                                   |
| Pedido al proveedor     | Admin → Proveedor           | Agrupar pedidos con adelanto confirmado, registrar fecha estimada y avances (producción, enviado, llegó). Los estados del cliente se actualizan solos.        |
| Entrega                 | Admin → Entrega             | Escanear el QR del recibo o buscar por código; cobrar el saldo (efectivo o SINPE) y marcar entregado. Se genera el recibo PDF.                                |
| Reseñas                 | Admin → Reseñas             | Aprobar o borrar. Solo las aprobadas son públicas.                                                                                                            |
| Seguimiento del negocio | Admin → Resumen / Bitácora  | Ventas, costos, utilidad y toda acción de admin registrada (quién, qué, cuándo).                                                                              |
| Respaldo                | Admin → Respaldo            | Exporta colecciones a JSON/CSV. **Hacerlo al menos una vez por semana** (el plan Spark no incluye copias automáticas).                                        |

El cliente consulta su pedido con el enlace `/?pedido=CODIGO` o el código en _Rastreo_.

## 4. Revisión de seguridad (subtarea 18)

### Resultado

| Área                       | Estado    | Detalle                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas por defecto         | OK        | Toda colección no declarada se deniega (prueba `endurecimiento general`).                                                                                                                                                                                                                                                                                                                               |
| Rol admin                  | OK        | `admins/{uid}` solo lo escribe un admin; un usuario no puede auto-promoverse. Una sesión anónima nunca es admin.                                                                                                                                                                                                                                                                                        |
| Datos privados             | OK        | `productPrivate` (costos), `orderPrivate`, `supplierOrders`, `paymentRefs` y `auditLog`: solo admin. `users`: solo su dueño o admin.                                                                                                                                                                                                                                                                    |
| Enumeración de pedidos     | OK        | `orders`: solo dueño o admin y siempre con filtro por `uid`. `orderTracking`: `get` público por código de 128 bits (32 hex, `crypto.getRandomValues`), **sin `list`**; no contiene datos personales (solo estado, línea de tiempo y resumen de camisas).                                                                                                                                                |
| Cupones                    | OK        | `get` por código con sesión, sin `list`. Quien conozca el código puede ver su tipo, valor y vigencia (es información que de todos modos se le muestra al aplicarlo).                                                                                                                                                                                                                                    |
| Integridad del pedido      | OK        | El pedido solo se crea junto a su rastreo (lote), con estado inicial fijo, `paidAmount: 0`, totales coherentes y adelanto mínimo. El cliente nunca cambia estado ni pagos.                                                                                                                                                                                                                              |
| Reseñas                    | Corregido | Las fotos eran una lista sin validar elementos. Ahora máx. 4 textos de 1 a 100 caracteres (`validPhotos`). Solo Google; nacen no aprobadas; el admin solo cambia `approved`.                                                                                                                                                                                                                            |
| Subida de archivos (Drive) | Corregido | Antes cualquier sesión podía subir sin límite. Ahora `Code.gs` limita a **10 subidas por hora por usuario no admin** (`checkRateLimit_`). Además: token verificado, firma real del archivo (JPG/PNG/WebP), máx. 4 MB, comprobantes en carpeta privada, `getReceipt`/`deleteFile` solo admin y solo dentro de nuestras carpetas. **Hay que volver a implementar el Web App** para que el límite aplique. |
| Secretos                   | OK        | `.env` está en `.gitignore`. Las claves `VITE_FIREBASE_*` son públicas por diseño. No hay credenciales de servicio. `settings/*` es de lectura pública: **no guardes ahí nada secreto**.                                                                                                                                                                                                                |
| Contenido enriquecido      | OK        | `RichText` no usa `dangerouslySetInnerHTML`; el contenido del admin se renderiza como texto estructurado.                                                                                                                                                                                                                                                                                               |

### Riesgos aceptados

1. **Precios en el pedido:** las reglas no pueden comparar el precio enviado contra el catálogo (Firestore no permite consultas dentro de reglas sobre varias líneas). Un cliente manipulado podría enviar un total menor. Mitigación: el admin revisa cada pedido y su pago antes de pedir al proveedor, y la bitácora registra los cambios. Para tu volumen es aceptable; si crece, mover la creación del pedido a un backend (requiere plan Blaze).
2. **Spam de pedidos:** un anónimo puede crear pedidos falsos. Mitigación: no cuestan nada hasta que se confirma el pago, y no se pueden borrar por el cliente. Se pueden ocultar desde el admin.
3. **Lectura pública de `settings`, `paymentMethods`, `sections`, etc.:** necesaria para que la tienda funcione sin iniciar sesión. Contienen solo información comercial (tu número de SINPE es público por naturaleza).
4. **Límite de subidas en Apps Script:** usa `CacheService`, que Google puede vaciar; en ese caso el límite se relaja. Es un freno al abuso, no una cuota exacta.
5. **Fotos de reseñas públicas:** al estar en la carpeta pública de Drive, cualquiera con el enlace las ve, incluso antes de aprobar la reseña (el ID no es adivinable). Se borran con el admin.

## 5. Cuotas del plan Spark

Límites diarios de Firestore: **50.000 lecturas, 20.000 escrituras, 20.000 borrados**; Hosting: 10 GB almacenados y 360 MB/día de transferencia.

| Pantalla / acción    | Lecturas aproximadas                                           | Medida aplicada                                                                      |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Catálogo (visitante) | 1 por camisa visible + secciones, hashtags, parches y tallas   | Caché en memoria de 5 minutos (`services/storefront.js`)                             |
| Detalle de camisa    | 0 si viene del catálogo; 1 + 1 de reseñas aprobadas (máx. 100) | Reutiliza la caché del catálogo                                                      |
| Botón de WhatsApp    | 2 por carga de la app                                          | Caché de 5 minutos (`getDocDataCached`) que se limpia al guardar ajustes o contenido |
| Ayuda                | 4 (contenido, pago, envío, general)                            | Una vez por visita a la pantalla                                                     |
| Checkout             | ~4 + métodos de pago                                           | Una vez por visita                                                                   |
| Mis pedidos          | hasta 100 (`MY_ORDERS_LIMIT`)                                  | Límite en la consulta                                                                |
| Admin → Pedidos      | hasta 200                                                      | Límite y caché de 1 minuto compartida con Proveedor y Entrega (`listOrders`)         |
| Admin → Proveedor    | hasta 200 (los pedidos salen de la caché de Pedidos)           | Límite + caché; toda escritura de admin vacía la caché                               |
| Admin → Usuarios     | `users` + `admins` (1 lectura por documento)                   | Caché de 1 minuto; sin paginación, pensado para una tienda pequeña                   |
| Inicio de sesión     | 1 lectura (`admins/{uid}`; 0 para el admin fijo) + 1 escritura | El perfil `users/{uid}` solo se reescribe si cambió o pasaron 24 h                   |
| Admin → Resumen      | hasta 500 pedidos + `productPrivate`                           | Límite + periodo                                                                     |
| Admin → Respaldo     | hasta 5.000 por colección                                      | Solo bajo demanda; evitar repetirlo el mismo día                                     |

Estimación: con 100 visitas diarias al catálogo (~40 camisas) se gastan ~5.000 lecturas, 10 % del límite. El punto a vigilar es el **Respaldo** y el **Resumen** con mucho historial: úsalos una o dos veces al día como máximo. Las lecturas del admin cuentan igual que las del público. Revisa el uso en Firebase → Firestore → Uso.

## 6. Recorrido de extremo a extremo (lista de verificación antes de abrir la tienda)

Hacerlo con una camisa de prueba y un pedido real pequeño:

1. Admin: crear sección, camisa con foto (prueba la subida a Drive) y marcarla visible.
2. `npm run deploy`. Abrir el sitio en el celular; instalar la PWA.
3. Visitante: ver catálogo → detalle → personalizar (nombre, número, parches) → carrito → checkout como **invitado** → subir comprobante → copiar el código.
4. Rastreo con el código: debe verse "pago pendiente de revisión".
5. Admin → Pedidos: abrir el comprobante, confirmar adelanto. El rastreo cambia.
6. Admin → Proveedor: crear pedido al proveedor, marcar enviado y "llegó". El rastreo cambia a "listo para entrega".
7. Admin → Entrega: escanear el QR (o código), cobrar saldo, marcar entregado. Descargar el recibo.
8. Cliente con Google: dejar una reseña con foto; el admin la aprueba y aparece en la camisa.
9. Admin → Resumen: la venta aparece; Admin → Bitácora: todas las acciones están registradas; Respaldo: exportar.

## 7. Limitaciones conocidas

- Drive y Firestore reales **no se han probado** desde el código; las pruebas automáticas usan el emulador de Firestore y funciones puras.
- El PDF del recibo solo admite caracteres Latin-1 (tildes y ñ sí; emojis no).
- El escáner de QR con cámara no se probó en un dispositivo real; se puede ingresar el código a mano.
- El Open Graph por camisa depende de ejecutar `npm run prerender` en cada despliegue.
- En móvil con red lenta simulada, el LCP es ~5 s por el `iframe.js` de Firebase Auth (rendimiento 100 sin simulación; accesibilidad, buenas prácticas y SEO en 100).
- Con ruta única (`MemoryRouter`) el botón Atrás del navegador sale de la app.
