# Plan: SuChemaFC – Catálogo y pedidos de camisetas de fútbol

## Top-Level Overview

**Objetivo:** construir desde cero una web app (PWA, mobile-first) para un pequeño negocio de camisetas de fútbol. Tiene catálogo inspirado en kitmm1.com, carrito, lista de deseos, checkout con adelanto por SINPE, y un módulo admin para gestionar catálogo, pagos, pedidos a proveedor, recibos y entregas.

**Stack (fijo):**
- Vite + React + JavaScript.
- Firebase Hosting + Firestore + Authentication (plan **Spark**, sin Cloud Functions ni Storage).
- Google Apps Script (Web App) como puente hacia Google Drive para imágenes y comprobantes.
- Idioma de la interfaz: español. Moneda: **solo colones (CRC)**, tanto en precios como en pagos.
- **Ruta del proyecto:** `C:\Users\Isra1\OneDrive\Documentos\SuChemaFC` (fuera del workspace actual del playground). Todo el código se crea ahí. Este plan permanece en `suchema-plan.md` y se copia a `docs/plan.md` del proyecto en la subtarea 0.
- **Nota sobre OneDrive:** esa carpeta se sincroniza. `node_modules`, `dist` y `.firebase` pueden generar miles de archivos y conflictos de sincronización. Se recomienda excluirlos de OneDrive (o ubicar el proyecto fuera de OneDrive). Se confirma con el usuario al iniciar la subtarea 0.

**Decisiones ya confirmadas**
- No hay envío automático de WhatsApp. Se usan enlaces `wa.me` con mensaje prellenado que el admin abre con un clic.
- Rol admin por colección `admins/{uid}`, verificada por Firestore Security Rules.
- Apps Script recibe la imagen en base64 más el ID token de Firebase, lo verifica y comprueba que el usuario sea admin antes de guardar.
- Los IDs de carpetas de Drive, la URL del Web App y otros datos externos los entrega el usuario durante la ejecución. Cada subtarea los deja como variables de entorno o como TODO marcado.
- Imágenes del catálogo: carpeta pública de Drive.
- Comprobantes SINPE: carpeta privada de Drive. Al verificar el pago, el admin solo registra el **número de comprobante** y la imagen se **borra** de Drive.
- Se compra como **invitado** o con Google. El invitado se rastrea con un código de pedido.
- Adelanto mínimo del **50%** por SINPE (porcentaje editable). El **saldo se paga contra entrega** (SINPE o efectivo) y el admin lo registra al escanear el QR.
- Envío por Correos de Costa Rica con tarifa extra, o entrega coordinada por WhatsApp. Ambas opciones y sus textos son editables desde el admin.
- Plazo estimado del proveedor: ~30 días, con fecha estimada sujeta a cambios (valor editable).
- Todo lo recomendado para admin va incluido: dashboard, costo y margen, pagos parciales, comprobantes duplicados, soft delete, auditoría, CSV, notas internas, escáner QR y recibo PDF.
- Cliente: búsqueda por hashtags, filtros y orden; personalización nombre/número; recargos por talla y parches; cupones y ofertas; rastreo con línea de tiempo; cómo comprar, FAQ y políticas; botón flotante de WhatsApp; reseñas con fotos; SEO y Open Graph; PWA.

**Restricciones técnicas de Spark que moldean el diseño** (a validar en la documentación oficial durante la ejecución)
- Sin Functions: no hay lógica de servidor. La integridad de precios y cupones se protege con reglas y con la revisión manual del admin antes de confirmar el adelanto.
- Cuotas diarias de Firestore: cachear el catálogo, paginar y evitar listeners innecesarios.
- Los crawlers de WhatsApp e Instagram no ejecutan JavaScript. El Open Graph por producto requiere prerender (ver subtarea 17).
- Apps Script: peticiones `POST` con `Content-Type: text/plain` para evitar el preflight de CORS. Las imágenes se comprimen en el cliente antes de enviarlas.

**Resumen del modelo de datos (alto nivel)**

| Colección | Contenido | Acceso |
|---|---|---|
| `admins/{uid}` | Marca de admin | Cada usuario lee su propio doc. Escribe solo un admin. |
| `users/{uid}` | Perfil, cart, wishlist | Dueño |
| `sections/{id}` | Árbol de secciones y subsecciones (`parentId`, orden, visible) | Lectura pública. Escribe un admin. |
| `tags/{id}` | Hashtags con alias (ej. laliga ↔ la liga) | Igual que `sections` |
| `products/{id}` | Camisa: nombre, descripción, precio CRC, secciones, tags, imágenes (IDs de Drive), grupos de parche, recargo por talla, personalización, oferta, **versiones opcionales (`variants[]`, `baseVariantName`, `sizes`)**, visible, soft delete | Lectura pública solo de visibles. Escribe un admin. |
| `productPrivate/{id}` | Costo del proveedor y margen (más `variantCosts`: costo por versión) | Solo admin |
| `patchGroups/{id}` | Categorías de parches y opciones (imagen, precio CRC) | Lectura pública. Escribe un admin. |
| `sizeCharts/{id}` | Categorías de guía de tallas y sus tablas | Lectura pública. Escribe un admin. |
| `coupons/{id}` | Cupón: tipo, alcance, vigencia, mínimos, usos | Lectura limitada. Escribe un admin. |
| `orders/{id}` | Pedido (ID aleatorio largo), cliente, líneas, totales, envío, pagos, estado por línea, notas | Dueño o admin. El invitado accede por código. |
| `orderTracking/{code}` | Vista pública mínima: estado, línea de tiempo, fecha estimada, resumen sin datos personales | `get` público, sin `list` |
| `supplierOrders/{id}` | Pedido a proveedor que agrupa líneas de clientes, estado y fecha estimada | Solo admin |
| `reviews/{id}` | Reseña, fotos, `approved` | Lectura pública si está aprobada |
| `settings/*` | WhatsApp, % adelanto, plazo, envío, textos de entrega, FAQ, políticas, cómo comprar | Lectura pública. Escribe un admin. |
| `paymentMethods/{id}` | Métodos de pago (SINPE: número, nombre, notas) | Lectura pública. Escribe un admin. |
| `paymentRefs/{numero}` | Unicidad de números de comprobante | Solo admin |
| `auditLog/{id}` | Bitácora de cambios | Solo admin |

---

## Sub-Tasks

### 0. Fundamentos del proyecto
- **Intent:** dejar la base técnica lista y desplegable.
- **Expected Outcomes:**
  - Proyecto Vite + React arrancando en local y desplegable a Firebase Hosting.
  - Estructura de carpetas, enrutado y layout responsive mobile-first.
  - Variables de entorno para Firebase y Apps Script.
- **Todo List:**
  1. Crear el proyecto Vite + React (JavaScript) en `C:\Users\Isra1\OneDrive\Documentos\SuChemaFC` y definir la estructura: `src/{pages,components,features,services,hooks,context,utils,styles}`. Inicializar git con `.gitignore` (incluye `node_modules`, `dist`, `.firebase`, `.env`).
  2. Configurar Tailwind CSS con tokens de color de la marca **SuChemaFC** (negro, dorado y blanco como detalle), modo claro y oscuro (oscuro por defecto, fondo 100% negro `#000000` y grises neutros sin matiz azul), selector de tema persistente y diseño mobile-first con breakpoints para tablet y desktop. Ver "Sistema de diseño y contraste" más abajo.
  3. Configurar React Router (rutas públicas, cliente, admin) y un layout con **navbar negro (`#000000`) fijo en ambos temas**, con logo, enlaces e íconos en dorado/blanco y una línea dorada inferior como separador. Incluye navegación inferior en móvil, footer y botón flotante de WhatsApp.
  4. Crear `firebase.json`, `.firebaserc`, `.env.example` y `src/services/firebase.js` (inicialización con caché local de Firestore).
  5. Configurar ESLint y Prettier y un README con pasos de instalación y despliegue.
  6. Integrar el logo de SuChemaFC (el emblema circular negro/dorado enviado por el usuario, con fondo negro): componente `Logo` reutilizable con variantes de tamaño, favicon, íconos PWA (192, 512 y maskable, con fondo negro) y `og-default.png` derivados del logo. Se usa en navbar, footer, login, recibos PDF, pantallas de carga y páginas de error. Como el logo tiene fondo negro, sobre superficies claras se muestra recortado en círculo (`rounded-full`) para que no aparezca un cuadrado negro.
  6b. Auditar el código existente (`src/App.jsx`, `src/App.css`, `src/index.css`, `index.html`, `public/favicon.svg`, `public/icons.svg`, `src/assets/{hero.png,react.svg,vite.svg}`): reemplazar todo rastro de la plantilla de Vite (logos, textos, colores y favicon) por la marca SuChemaFC y verificar que ningún color fuera de la paleta negro/dorado/blanco/grises neutros quede en uso.
  7. **[Intervención del usuario]** Crear el proyecto Firebase (Spark) y entregar la configuración web.
  8. **[Intervención del usuario]** Guardar el archivo del logo (la imagen adjunta en el chat no tiene ruta accesible y hoy no existe en el proyecto) en `C:\Users\Isra1\OneDrive\Documentos\SuChemaFC\src\assets\logo.png`, idealmente cuadrado y de al menos 1024 px. Mientras tanto se usa un placeholder.
- **Relevant Context:** el proyecto partió de la plantilla base de Vite + React en `C:\Users\Isra1\OneDrive\Documentos\SuChemaFC`. Decisión confirmada: migrar de `oxlint` a ESLint + Prettier.
- **Notas de ejecución:** implementado Tailwind v4 con tokens en `src/index.css`, tema claro/oscuro persistente (oscuro por defecto), React Router, layout con **navbar negro fijo** (`Navbar`, `BottomNav`, `Footer`, `WhatsAppButton`), componente `Logo` con placeholder (usa `src/assets/logo.png|webp|svg` si existe), favicon de marca, `firebase.json`/`.firebaserc`/`.env.example`/`src/services/firebase.js`, ESLint + Prettier (oxlint retirado), README, `docs/plan.md`, página `/__design` (solo dev) y scripts `check:contrast` y `check:brand`. Plantilla de Vite eliminada. Validado: lint, format:check, contraste AA, marca y build pasan. `firebase.json`, `.firebaserc`, `firestore.rules` y `firestore.indexes.json` ya los había generado la CLI de Firebase; `.firebaserc` apunta a `suchemafc` (confirmar ID real) y `firestore.rules` es temporal (expira el 2026-12-08) y se reemplaza en la subtarea 2.
- **Logo (hecho):** el logo oficial es el emblema de la camiseta (1254×1254) en `src/assets/logo.png`; `Logo.jsx` lo carga solo y, sin archivo, muestra únicamente el texto (nunca una imitación). Derivados generados en `public/`: `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`, `og-default.png` (1200×630, fondo negro), `icons/icon-192.png`, `icons/icon-512.png` e `icons/icon-maskable-512.png` (logo al 80 % para la zona segura). `index.html` enlaza favicon, apple-touch-icon y metaetiquetas Open Graph. El manifest PWA que usa esos íconos se crea en la subtarea 17. En el navbar el logo mide 48 px (`size="nav"`).
- **Ajuste de navbar y footer (hecho):** se usan íconos de Material (`react-icons/md`). Tema, Ingresar, Salir, Admin y Ayuda son botones de solo ícono con tooltip accesible (`src/components/Tooltip.jsx`, visible con hover y foco, más `aria-label`). Con sesión de Google el navbar muestra foto y nombre (el nombre se oculta en pantallas muy angostas). El footer ahora es mínimo: negro con borde dorado, eslogan "Tu equipo, tus colores, tu pasión." y "© {año actual} SuChemaFC". Los enlaces "Cómo comprar" y "Preguntas frecuentes" pasaron a una sola página `/ayuda` (`src/pages/Help.jsx`) con subsecciones (cómo comprar, preguntas frecuentes, envíos, cambios y devoluciones), accesible desde el ícono de Ayuda del navbar. El texto es provisional; la subtarea 15 lo hace editable desde el admin.
- **Pendiente de la subtarea 0:** ninguno de los pasos 7 y 8: Firebase (`.env`) y logo ya fueron entregados.
- **Status:** `[x] done` (salvo los pendientes anteriores)

### 1. Autenticación y roles
- **Intent:** inicio de sesión con Google, sesión anónima para invitados y detección del rol admin.
- **Expected Outcomes:**
  - Login y logout con Google.
  - Invitados con sesión anónima de Firebase Auth. Esto permite que Apps Script valide su token y que las reglas exijan `request.auth`.
  - Hook `useAuth` con `user`, `isAdmin` y `isGuest`.
  - Rutas `/admin/*` protegidas.
- **Todo List:**
  1. Habilitar Google y Anonymous en Firebase Auth (paso manual del usuario).
  2. Implementar el `AuthContext` y la lectura de `admins/{uid}`.
  3. Al iniciar sesión con Google, crear o actualizar `users/{uid}`. Fusionar carrito y wishlist locales del invitado (ver subtarea 7).
  4. Crear el guard de rutas admin y la página de acceso denegado.
  5. **[Intervención del usuario]** Crear manualmente el primer doc `admins/{uid}` en la consola de Firestore.
- **Relevant Context:** `src/context/AuthContext.jsx`, `src/context/authContext.js`, `src/hooks/useAuth.js`, `src/services/auth.js`, `src/components/{RequireAdmin,UserMenu}.jsx`, `src/pages/{Login,AccessDenied}.jsx`.
- **Notas de ejecución:** `useAuth` devuelve `user`, `isAdmin`, `isGuest`, `loading`, `configured` y `error`. La sesión anónima **no se crea al entrar**: se crea con `ensureSession()` cuando hace falta (checkout o subir comprobante), para no llenar Auth de usuarios anónimos por cada visita. Al iniciar con Google estando como invitado se usa `linkWithPopup`, así se conserva el mismo uid y los pedidos ya hechos; si esa cuenta de Google ya existía, se inicia sesión en ella. Se usa `onIdTokenChanged` (y no `onAuthStateChanged`) porque solo este avisa del cambio anónimo → Google con el mismo uid. `firebase.js` ya no falla sin `.env`: expone `isFirebaseConfigured` y la app arranca con el login deshabilitado y un aviso. Ruta `/login` y `/admin/*` protegida por `RequireAdmin` (redirige al login o muestra "Acceso denegado"). La fusión de carrito y wishlist locales queda para la subtarea 7 (aún no existen). **No probado con un Firebase real** (falta `.env`); la lógica de rol sí está cubierta por las pruebas de reglas.
- **Ajuste de acceso (hecho):** el ícono de Ingresar del navbar (`MdLogin`, de Material) abre el popup de Google directamente, sin pasar por `/login`. Los errores se muestran en un aviso bajo el botón (cerrar la ventana a propósito no se muestra como error). La página `src/pages/Login.jsx` se **conserva oculta**, sin ningún enlace que lleve a ella, para añadir más métodos de acceso más adelante; su botón "Continuar con Google" sí lleva el logo de Google (`src/assets/google-g.svg`). Los mensajes de error se movieron a `authErrorMessage()` en `src/services/auth.js` para compartirlos. `RequireAdmin` sigue redirigiendo a `/login` cuando alguien sin sesión intenta entrar a Administración.
- **Pendiente:** habilitar Google y Anonymous en Firebase Auth, añadir `localhost` a dominios autorizados, y crear el primer `admins/{uid}` (pasos del usuario).
- **Status:** `[x] done` (salvo pasos 1 y 5, que son del usuario)

### 2. Modelo de datos y reglas de seguridad de Firestore
- **Intent:** fijar el esquema y las reglas antes de construir pantallas, porque sin Functions las reglas son la única barrera.
- **Expected Outcomes:**
  - `firestore.rules` y `firestore.indexes.json` versionados.
  - Documento de esquema (`docs/data-model.md`) con los campos de cada colección.
  - Pruebas de reglas con el emulador.
- **Todo List:**
  1. Documentar los campos y las relaciones de cada colección de la tabla anterior.
  2. Reglas por rol: lectura pública solo de productos visibles y no eliminados, escritura solo de admins y datos privados aparte (`productPrivate`).
  3. `orders`: creación autenticada (incluida la anónima) con validación de forma y de que el total mínimo coincida con las reglas. El dueño solo lee lo suyo. Solo el admin cambia estados y pagos.
  4. `orderTracking`: `get` por código largo no adivinable, sin `list`, y solo con datos no personales.
  5. Cupones: control de usos con escritura transaccional limitada. Documentar la limitación de Spark.
  6. Configurar el emulador de Firestore y escribir pruebas de reglas.
- **Relevant Context:** `firestore.rules`, `docs/data-model.md`, `tests/firestore.rules.test.js`, `firebase.json` (emulador en el puerto 8080).
- **Notas de ejecución:** reglas por rol con validación de forma, rangos y aritmética. Cambios de diseño respecto al plan, ya reflejados en `docs/data-model.md`: (a) se añadió `orderPrivate/{id}` para las notas internas, porque las reglas son por documento y el cliente lee su propio pedido; (b) el pedido, su `orderTracking` y el uso del cupón se crean en **un solo lote** (`writeBatch`) y las reglas lo exigen con `getAfter()`; (c) un descuento solo es válido con cupón; (d) el adelanto mínimo se valida contra `settings/payment.advancePercent`, que **debe existir** o los pedidos se rechazan; (e) la reseña usa el ID `{productId}_{uid}`. Las pruebas necesitan **Java** (se instaló OpenJDK 21 con winget): `npm run test:rules` → 32 pruebas pasan y `firebase deploy --only firestore:rules --dry-run` compila sin avisos. Las reglas **no están publicadas**: siguen siendo las de prueba en la consola hasta ejecutar `firebase deploy --only firestore:rules` (las de prueba vencen el 2026-12-08). Son un prototipo sólido, no una garantía; revisar antes de abrir al público. Limitaciones de Spark documentadas al final de `docs/data-model.md`.
- **Pendiente:** publicar las reglas y crear `settings/payment` (`advancePercent: 50`) al tener el proyecto Firebase listo.
- **Status:** `[x] done` (salvo publicar reglas)

### 3. Apps Script: puente a Google Drive
- **Intent:** guardar imágenes y comprobantes en Drive sin cargar Firebase.
- **Expected Outcomes:**
  - Web App de Apps Script con acciones para subir imagen pública, subir comprobante privado, borrar archivo y listar o descargar un comprobante para el admin.
  - Verificación de identidad en cada petición.
  - Cliente JS (`src/services/drive.js`) con compresión previa de imágenes (WebP, tamaño máximo).
- **Todo List:**
  1. Escribir el script en `apps-script/Code.gs` (versionado en el repo) con CORS tolerante (`text/plain`).
  2. Verificar el ID token con la API REST de Identity Toolkit. Para acciones de admin, comprobar `admins/{uid}` vía REST de Firestore usando el mismo token del usuario. Así no se necesitan credenciales de servicio.
  3. Acciones:
     - `uploadCatalogImage`: solo admin; guarda en la carpeta pública y devuelve el ID.
     - `uploadReviewPhoto`: usuarios con sesión de Google; guarda en la carpeta pública y queda pendiente de moderación.
     - `uploadReceipt`: cualquier sesión, incluida la anónima; guarda en la carpeta privada.
     - `getReceipt`: solo admin; devuelve el archivo para visualizarlo.
     - `deleteFile`: solo admin; manda el archivo a la papelera.
  4. Utilidad de URL de imagen pública (`lh3.googleusercontent.com/d/{id}`), con tamaños para miniaturas.
  5. Límites: tipo MIME permitido, tamaño máximo y nombres de archivo seguros.
  6. Guía de despliegue en `docs/apps-script-setup.md`.
  7. **[Intervención del usuario]** Crear las carpetas de Drive (pública y privada), pegar los IDs en el script, desplegar como Web App y entregar la URL.
- **Relevant Context:** `apps-script/Code.gs`, `apps-script/appsscript.json`, `src/services/drive.js`, `docs/apps-script-setup.md`.
- **Notas de ejecución:** implementadas las 5 acciones con verificación de ID token (Identity Toolkit) y de admin (REST de Firestore con el token del usuario). Extras de seguridad: se valida la firma real del archivo (no solo el MIME), `getReceipt` solo lee de la carpeta privada y `deleteFile` solo toca archivos dentro de las dos carpetas configuradas. El cliente (`drive.js`) expone `uploadCatalogImage`, `uploadReviewPhoto`, `uploadReceipt`, `getReceiptDataUrl`, `deleteDriveFile`, `compressImage` (WebP, máx. 1600 px) y `driveImageUrl(id, ancho)`. Solo se verificó la sintaxis de `Code.gs` (`node --check`); **no se ha ejecutado contra Drive** porque faltan las carpetas, la URL y el `.env`. Se detectó que `sign_in_provider` de una sesión anónima se infiere por la ausencia de `providerUserInfo` en la respuesta de Identity Toolkit: validar en la primera prueba real.
- **Pendiente:** paso 7 (usuario). Probar de extremo a extremo cuando existan carpetas, URL y `.env`.
- **Status:** `[x] done` (salvo paso 7 y la prueba real contra Drive)

### 4. Admin: mantenimiento del catálogo
- **Intent:** que el admin pueda gestionar todo el catálogo sin tocar código.
- **Expected Outcomes:**
  - Administración de secciones y subsecciones (crear, renombrar, reordenar, ocultar, eliminar).
  - Administración de hashtags y alias.
  - Administración de grupos de parches y opciones (imagen y precio en CRC).
  - Administración de camisas: crear, editar, ocultar o mostrar y eliminar con soft delete.
- **Todo List:**
  1. Pantallas de secciones (árbol editable) y de hashtags con alias.
  2. Pantallas de grupos de parches y sus opciones, con carga de imagen vía Drive.
  3. Formulario de camisa:
     - Datos básicos y descripción.
     - Precio base en CRC y recargos por talla (ej. 3XL y 4XL).
     - Secciones, hashtags y varias imágenes con orden.
     - Grupos de parche aplicables.
     - Opciones de personalización (nombre/número) y su recargo.
     - Visible u oculta.
     - Costo del proveedor guardado en `productPrivate`.
  4. Lista admin con búsqueda, filtros, acciones masivas (ocultar o mostrar) y restaurar eliminadas.
  5. Registrar cada cambio en `auditLog` (helper reutilizable).
- **Relevant Context:** `src/features/admin/{AdminLayout.jsx,adminNav.js}`, `src/features/admin/catalog/*`, `src/services/{catalog,audit,db}.js`.
- **Notas de ejecución:** pestañas `Camisas`, `Secciones`, `Hashtags` y `Parches` en `/admin/*` (con íconos de Material). Cada cambio (crear, editar, ocultar, reordenar, eliminar, restaurar) se escribe junto con su entrada de `auditLog` en **un solo lote** (`commitWithAudit`, `src/services/audit.js`), así no queda un cambio sin bitácora. Secciones: árbol con subsecciones, renombrar, subir/bajar, ocultar y eliminar (se bloquea si tiene subsecciones o camisas). Hashtags: el ID es el slug del nombre y los alias se guardan normalizados; no se borra uno en uso. Parches: opciones con imagen (Drive) y precio. Camisa: datos, precio, costo privado (`productPrivate`, con margen), secciones, hashtags, varias imágenes ordenables, recargos por talla (S a 4XL), grupos de parche, personalización y visibilidad. Lista: búsqueda, filtro por estado y sección, selección múltiple con mostrar/ocultar/eliminar/restaurar (soft delete). `sale` se guarda `null` al crear; la oferta es de la subtarea 8. Se añadieron 4 pruebas de reglas del lote de catálogo. **Limitaciones:** (a) subir imágenes requiere el Apps Script configurado (carpetas, URL en `.env`), aún pendiente del usuario; (b) las consultas de lista leen toda la colección (aceptable para un catálogo pequeño; se pagina en la subtarea 5/17 si crece); (c) el nombre de un hashtag no se puede renombrar, porque su ID es el slug; (d) la pantalla no se probó contra Firestore real.
- **Status:** `[x] done` (la subida de imágenes depende del paso 7 de la subtarea 3)

### 5. Catálogo público: listado, búsqueda y detalle
- **Intent:** experiencia de compra al estilo kitmm1, optimizada para móvil.
- **Expected Outcomes:**
  - Home con secciones destacadas, ofertas y nuevos productos.
  - Listado con paginación, filtros (sección, liga, equipo, temporada, versión, precio), orden y búsqueda por hashtags y alias.
  - Detalle de camisa con galería, selector de talla, parches y botón de compra.
- **Todo List:**
  1. Navegación por secciones con migas de pan (Inicio > Selecciones > América > Argentina > …).
  2. Estrategia de caché: Firestore con persistencia local, consultas paginadas y búsqueda del lado del cliente sobre el índice cacheado (normalizando acentos y mayúsculas). Evitar `onSnapshot` en catálogo.
  3. Búsqueda: si escriben `laliga`, `premier` o `messi`, resolver por hashtags y alias a las camisetas correspondientes.
  4. Página de detalle: galería, precio en CRC, talla (con recargo visible), grupos de parche con precio (como la referencia), cantidad y total dinámico.
  5. Estados: cargando (skeletons), vacío y error.
- **Relevant Context:** `src/pages/{Home,Catalog,Product}.jsx`, `src/features/catalog/*`, `src/features/pricing/price.js`, `src/services/storefront.js`.
- **Notas de ejecución:** `storefront.js` carga el catálogo con una sola consulta de camisas (`visible == true` y `deleted == false`, como exigen las reglas) más secciones visibles, hashtags y parches, y lo guarda 5 minutos en memoria; no usa `onSnapshot`. Búsqueda, filtros y orden son funciones puras en `features/catalog/search.js`: normalizan acentos y mayúsculas, exigen todas las palabras y buscan en nombre, descripción, hashtags **y sus alias** (`laliga` encuentra `la liga`). Filtros: sección (incluye subsecciones, con migas de pan y botones de subsección), hashtag y rango de precio vigente; orden por recientes, precio o nombre; "Ver más" de 12 en 12. Los filtros se recuerdan al volver del detalle. Detalle: galería, talla con recargo visible, grupos de parche con precio, cantidad y total dinámico (`unitPrice` en `features/pricing/price.js`, reutilizable por el carrito). Portada: secciones, ofertas vigentes y novedades. Estados de carga con esqueletos, vacío y error. El botón "Agregar al carrito" existe pero no hace nada hasta la subtarea 7. Rutas internas `producto/:id` y `catalogo?seccion=ID` (la barra de direcciones sigue mostrando solo el dominio). 11 pruebas unitarias nuevas en `tests/catalog.test.js`. **Limitaciones:** el filtro por liga, equipo, temporada y versión del plan se resuelve con secciones y hashtags (no hay campos propios); sin datos reales de Firestore no se vio con productos; el precio de oferta depende de `sale`, que se edita en la subtarea 8.
- **Status:** `[x] done`

### 6. Personalización y guía de tallas interactiva
- **Intent:** que personalizar sea muy intuitivo y que el cliente escoja su talla con seguridad.
- **Expected Outcomes:**
  - Personalización con nombre y número, con vista previa visual de la espalda de la camiseta y validaciones.
  - Modal interactivo de guía de tallas, con categorías de medidas (ej. hombre, mujer, niño) y su tabla de equivalencias.
  - Mantenimiento admin de categorías y tablas de tallas.
- **Todo List:**
  1. Componente de personalización: campos de nombre y número, límites de caracteres, vista previa en vivo y recargo mostrado.
  2. Modal de guía de tallas: selector de categoría, tabla de equivalencias y cambio de unidad (cm/in). Se abre desde el detalle del producto.
  3. Pantalla admin para crear y editar categorías y tablas (`sizeCharts`).
  4. Cargar datos iniciales tomando como referencia https://www.kitmm1.com/Size-Chart-n2009886.html (los valores finales los valida el admin).
- **Relevant Context:** `src/features/personalization/*`, `src/features/sizeChart/*`, `src/features/admin/sizeCharts/*`.
- **Notas de ejecución:** Personalización: `features/personalization/personalization.js` (funciones puras: limpia el texto a mayúsculas sin símbolos, nombre de hasta 12 caracteres, número de 0 a 99, exige nombre o número) y `PersonalizationEditor.jsx` (casilla, campos, error accesible y vista previa SVG de la espalda en negro y dorado). Solo aparece si la camisa tiene `personalization.enabled`; el recargo se suma en `unitPrice` solo si la personalización es válida, y el botón de agregar se bloquea mientras sea inválida. Guía de tallas: `SizeGuide.jsx` (botón en el detalle y `<dialog>` modal, que maneja foco y Esc) con selector de categoría, cambio cm/pulg. y tabla accesible; las medidas se guardan en cm. El catálogo público ahora carga también `sizeCharts` (`storefront.js`); si no hay ninguna, el botón no se muestra. Admin: pestaña `Tallas` (`/admin/tallas`, `SizeChartsPage.jsx`) para crear, editar y eliminar categorías, con medidas y tallas dinámicas, y botón "Cargar tallas iniciales" (`SEED_CHARTS`) cuando no hay ninguna; todo con bitácora en un lote. `docs/data-model.md` actualizado con el esquema nuevo (`name, note, order, measures, rows`). Pruebas: 22 unitarias (`tests/personalization.test.js` y `catalog.test.js`) y 1 de reglas para `sizeCharts` (`npm run test:rules` pasa). **Limitaciones:** `kitmm1.com` responde 403, así que los datos iniciales son aproximados y el admin debe validarlos; el botón "Agregar al carrito" sigue sin acción hasta la subtarea 7, que deberá guardar `personalizationValue(custom)` en la línea; la pantalla no se probó contra Firestore real.
- **Status:** `[x] done`

### 7. Lista de deseos y carrito
- **Intent:** guardar lo que el cliente quiere comprar ahora o más adelante.
- **Expected Outcomes:**
  - Carrito con cantidades, talla, parches y personalización por línea.
  - Lista de deseos.
  - Persistencia: local para invitados y en Firestore para usuarios con Google.
- **Todo List:**
  1. Estado del carrito con cálculo de totales en CRC (precio base + talla + parches + personalización − oferta).
  2. Persistencia local para invitados (localStorage o IndexedDB).
  3. Con Google: guardar en `users/{uid}`, con escrituras agrupadas para no gastar cuota.
  4. Al iniciar sesión, fusionar el carrito y la wishlist locales con los remotos.
  5. Revalidar precios contra el catálogo actual al abrir el carrito y avisar de cambios.
  6. Página de wishlist con acción de mover al carrito.
- **Relevant Context:** `src/context/CartContext.jsx`, `src/features/cart/*`, `src/pages/{Cart,Wishlist}.jsx`, `src/services/userData.js`.
- **Notas de ejecuciÃ³n:** LÃ³gica pura en `src/features/cart/cart.js`: una lÃ­nea guarda solo la **selecciÃ³n** (`productId`, talla, parches, personalizaciÃ³n, cantidad y `priceAt`, el precio que vio el cliente), nunca precios; `priceCart` los recalcula siempre contra el catÃ¡logo con `unitPrice`. La llave de lÃ­nea es estable (misma camisa, talla, parches y texto = misma lÃ­nea, se suma la cantidad hasta 10; mÃ¡ximo 50 lÃ­neas y 200 favoritos, igual que las reglas). `CartContext.jsx` (`useCart`): invitados solo en `localStorage` (`suchema.cart.v1`); con Google se guarda ademÃ¡s en `users/{uid}` con **una sola escritura agrupada 1,5 s despuÃ©s del Ãºltimo cambio** (`services/userData.js`, `updateDoc`) y solo si el JSON cambiÃ³. Al iniciar sesiÃ³n: si la copia local es de un invitado se **fusiona** con la remota (misma lÃ­nea = mayor cantidad, sin duplicar; favoritos = uniÃ³n); si ya era de esa cuenta manda la remota. Al cerrar sesiÃ³n se vacÃ­a la copia local (equipos compartidos). PÃ¡ginas: `/carrito` (`Cart.jsx`: miniatura, talla, parches, personalizaciÃ³n, cantidad, quitar, vaciar, subtotal, revalida precios al abrir y, si cambiaron, muestra aviso y exige "Aceptar precios actuales" antes de finalizar; las camisas que salieron del catÃ¡logo se marcan y no se cobran) y `/deseos` (`Wishlist.jsx`, con "Elegir talla" porque mover al carrito exige talla). El detalle de camisa ya agrega al carrito (con aviso accesible y enlace al carrito) y tiene corazÃ³n de deseos. Navbar: Ã­cono de deseos (`MdFavoriteBorder`) y burbuja con la cantidad en Carrito (navbar y barra inferior, `CartBadge.jsx`). El botÃ³n "Finalizar compra" apunta a `/checkout` (subtarea 9). Pruebas: 15 unitarias (`tests/cart.test.js`) y 1 de reglas (`users` acepta carrito y deseos dentro de los lÃ­mites y rechaza excederlos o escribir en otra cuenta); `npm run test:rules` pasa. **Limitaciones:** no se probÃ³ la sincronizaciÃ³n contra Firestore real ni el flujo de iniciar sesiÃ³n con carrito de invitado; el cupÃ³n y el envÃ­o no aparecen en el carrito hasta las subtareas 8 y 9; `/checkout` aÃºn no existe como ruta.
- **Status:** `[x] done`

### 8. Cupones y ofertas
- **Intent:** descuentos aplicables por producto o por cupón en el checkout.
- **Expected Outcomes:**
  - Ofertas por camisa con precio rebajado, vigencia y cuenta regresiva opcional.
  - Cupones con porcentaje o monto fijo, alcance (todo, secciones o camisas), mínimos, vigencia y límite de usos.
  - Aplicación del cupón en el checkout con el descuento visible.
- **Todo List:**
  1. Pantallas admin de ofertas (masivas por selección de camisas) y de cupones.
  2. Motor de cálculo de descuentos como función pura y probada.
  3. Campo de cupón en el carrito y checkout, con mensajes de error claros.
  4. Registrar el cupón aplicado en el pedido y controlar los usos según las reglas de la subtarea 2.
- **Relevant Context:** `src/features/pricing/*`, `src/features/admin/promotions/*`, `src/services/promotions.js`.
- **Notas de ejecuciÃ³n:** Motor puro y probado (19 pruebas en `tests/promotions.test.js`): `features/pricing/sale.js` (precio de oferta por porcentaje 1 a 90 % o precio fijo, validaciÃ³n, estado activa/programada/vencida, texto de cuenta regresiva) y `features/pricing/coupon.js` (`normalizeCode`, `couponProblem`, `inCouponScope` con subsecciones, `evaluateCoupon` y `validateCouponForm`). El descuento del cupÃ³n es entero (hacia abajo), se calcula solo sobre las camisas dentro del alcance (todo, secciones o camisas), nunca supera ese subtotal, y la compra mÃ­nima se mide sobre todo el carrito. Admin: pestaÃ±as `Ofertas` y `Cupones`. Ofertas (`SalesPage.jsx`): selecciÃ³n masiva de camisas con bÃºsqueda y filtro, tipo porcentaje o precio fijo, fechas opcionales y cuenta regresiva opcional (exige fecha final); se aplica o se quita en **un solo lote con bitÃ¡cora** (`applySales`); las camisas que no quedarÃ­an rebajadas se omiten y se avisa. Cupones (`CouponsPage.jsx`): crear, editar, activar o desactivar y eliminar; alcance por secciones o camisas, mÃ­nimo, lÃ­mite de usos (0 = ilimitado) y vigencia obligatoria (las reglas la exigen para registrar usos); el cÃ³digo no cambia al editar y editar nunca toca `usedCount` ni `lastOrderId`. Cliente: el carrito tiene `CouponBox` (campo, mensajes claros y descuento visible) y muestra "Total con descuento"; el cÃ³digo aplicado vive en `CartContext` (`couponCode`, solo en este dispositivo) y se revalida cada vez que se abre el carrito. El detalle de camisa muestra la cuenta regresiva (`SaleCountdown`) cuando la oferta la pidiÃ³. Refactor menor: `CheckList` saliÃ³ de `ProductForm` a `components/CheckList.jsx` para reutilizarlo; `toMillis` y fechas de formulario quedaron en `utils/dates.js`. Reglas: no cambiaron; se aÃ±adieron 3 pruebas (admin crea y edita cupones y un cliente no; un cupÃ³n desactivado no admite registrar un uso; admin aplica una oferta con fechas y cuenta regresiva) y `npm run test:rules` pasa. **Pendiente para la subtarea 9:** guardar en el pedido `couponCode` y `discount` y registrar el uso (`usedCount + 1` y `lastOrderId`) en el mismo lote. **Limitaciones:** el lÃ­mite de usos cuenta pedidos y no personas (no se puede garantizar un uso por cliente sin Functions); un cliente malicioso podrÃ­a saltarse el mÃ­nimo o el alcance porque las reglas solo validan forma y aritmÃ©tica, y lo detecta la revisiÃ³n manual del admin; no se probÃ³ contra Firestore real; el descuento no se refleja aÃºn en `/checkout` porque esa ruta llega en la subtarea 9.
- **Status:** `[x] done`

### 9. Checkout, SINPE y envío
- **Intent:** convertir el carrito en un pedido con adelanto verificable.
- **Expected Outcomes:**
  - Flujo: datos del cliente, entrega o envío, resumen, instrucciones de SINPE y comprobante.
  - Pedido creado con código de seguimiento no adivinable.
  - Admin puede editar métodos de pago y textos de envío y entrega.
- **Todo List:**
  1. Formulario de datos: nombre, teléfono y correo (precargados con Google si aplica) y dirección completa.
  2. Selección de envío (Correos de Costa Rica con tarifa extra editable) o entrega coordinada por WhatsApp. Los textos explicativos vienen de `settings`.
  3. Pantalla de pago: monto mínimo (50% editable), datos de SINPE desde `paymentMethods` y subida del comprobante con vista previa vía Drive (carpeta privada).
  4. Crear `orders` y `orderTracking` con estado inicial "pago pendiente de revisión". Mostrar el código de pedido y un enlace de rastreo.
  5. Botón de WhatsApp con mensaje prellenado y el resumen del pedido.
  6. Admin: mantenimiento de métodos de pago (agregar, quitar y editar), tarifa de envío, textos y número de WhatsApp.
- **Relevant Context:** `src/features/checkout/*`, `src/features/admin/settings/*`, `src/pages/Checkout.jsx`, `src/services/orders.js`.
- **Notas de ejecución:** Lógica pura en `features/checkout/checkout.js` y `settings.js` (24 pruebas en `tests/checkout.test.js`): validación de datos (dirección obligatoria solo con Correos), carga útil del cliente tal como la validan las reglas, adelanto mínimo (`minAdvance`), líneas del pedido con nombre y precio de ese momento, código de rastreo de 128 bits, enlace `/?pedido=CODIGO`, mensaje y enlace `wa.me`. `/checkout` (`pages/Checkout.jsx`): entrega (Correos con tarifa editable o coordinación por WhatsApp) → datos (precargados con Google) → resumen con cupón → pago SINPE con los métodos de `paymentMethods`, adelanto editable (nunca menor al porcentaje configurado) y comprobante. El comprobante se sube a Drive antes del pedido y su ID se reutiliza en reintentos. Se bloquea la compra si hay precios cambiados, camisas no disponibles, cupón inválido o más de 30 líneas. `services/orders.js` (`placeOrder`) crea `orders` + `orderTracking` + uso del cupón en **un solo lote**; `OrderConfirmation.jsx` muestra el código, el enlace de rastreo copiable y el botón de WhatsApp con el resumen. Admin: pestaña `Ajustes` (`/admin/ajustes`, `StoreSettingsPage.jsx`) con porcentaje de adelanto, Correos (activo, tarifa, texto), WhatsApp (número y texto) y CRUD de métodos de pago, todo con bitácora. Reglas: sin cambios; 4 pruebas nuevas (lote completo como lo arma `placeOrder` con Correos, cupón, comprobante y rastreo; lote sin cupón; adelanto insuficiente rechazado; `settings` y `paymentMethods` de lectura pública y escritura solo admin). `npm run test:rules` pasa (125 pruebas en total). `docs/data-model.md` actualizado. **Limitaciones:** la subida a Drive y el flujo con Firestore real nunca se probaron (`VITE_APPS_SCRIPT_URL` y `VITE_WHATSAPP_NUMBER` vacíos y reglas sin publicar); antes de vender hay que crear `settings/payment` con `advancePercent: 50`, el primer `admins/{uid}` y al menos un método de pago; las reglas no pueden validar precios ni descuentos contra el catálogo (el admin revisa cada pedido en la subtarea 10); el botón flotante de WhatsApp aún usa solo `VITE_WHATSAPP_NUMBER` (se unifica con `settings/general` en la subtarea 15); la lectura de `?pedido=` al entrar queda para la subtarea 12.
- **Status:** `[x] done`

### 10. Admin: revisión de pagos y pedidos de clientes
- **Intent:** validar adelantos y controlar el ciclo de cada pedido.
- **Expected Outcomes:**
  - Bandeja de pedidos con filtros por estado.
  - Revisión del comprobante: ver imagen, botón **Comprobar** que pide solo el número de comprobante, borra la imagen de Drive y confirma el adelanto.
  - Detección de comprobantes duplicados.
  - Notas internas y pagos parciales (adelanto y saldo).
- **Todo List:**
  1. Lista y detalle de pedido admin (cliente, líneas, totales, pagos, notas).
  2. Visor del comprobante vía `getReceipt`.
  3. Acción "Comprobar": registrar el número en `paymentRefs` (si ya existe, advertir duplicado), actualizar el pago, el estado y la línea de tiempo, y llamar a `deleteFile`.
  4. Acción "Rechazar": con motivo y aviso por `wa.me`.
  5. Mostrar saldo pendiente. Cancelar pedido, con soft delete y bitácora.
  6. Notas internas por pedido.
- **Relevant Context:** `src/features/admin/orders/*`, `src/features/orders/orderStatus.js`, `src/services/adminOrders.js`.
- **Notas de ejecución:** Lógica pura en `features/admin/orders/review.js` y `features/orders/orderStatus.js` (17 pruebas en `tests/orders.test.js`): estados con etiqueta en español, pagado/saldo/adelanto faltante, validación del comprobante y monto, `applyPayment` (el adelanto se confirma al alcanzar `advanceRequired`; un pago menor queda como parcial; un pedido ya avanzado no retrocede de estado; un pago rechazado se reactiva al cubrir el adelanto), filtros y conteos de la bandeja y mensajes `wa.me` para el cliente. Admin: pestaña `Pedidos` (`/admin/pedidos`, ahora la pestaña de inicio de `/admin`) con `OrdersPage.jsx`: bandeja con chips por estado (con conteo; por defecto "pago pendiente de revisión") y búsqueda por referencia, nombre o teléfono; detalle con cliente, entrega, camisas, totales, pagos y saldo pendiente; visor del comprobante bajo demanda (`getReceiptDataUrl`, no se descarga hasta pulsar "Ver comprobante"); formulario **Comprobar y confirmar** (número de comprobante + monto) que avisa de duplicados al salir del campo y, al guardar, registra `paymentRefs`, el pago, el estado, el historial público del rastreo y la bitácora en **un solo lote** (`confirmPayment`); después borra la foto de Drive y quita `receiptFileId` del pedido (`deleteReceipt`; si Drive falla, el pago queda registrado y se avisa). **Rechazar pago** con motivo (visible en el rastreo) y botón de aviso por WhatsApp; **Cancelar pedido** con borrado lógico (`deleted: true`, estado `cancelado`) y bitácora; notas internas en `orderPrivate` (nunca las lee el cliente). Reglas: `paymentRefs` ahora solo permite `create`/`delete` y niega `update`, así un mismo número de comprobante no se puede registrar dos veces ni siquiera por una carrera entre dos admins. 4 pruebas de reglas nuevas (lote de confirmación admin vs. cliente, comprobante duplicado rechazado, cancelación lógica sin borrado, notas internas); `npm run test:rules` pasa. `docs/data-model.md` actualizado. **Limitaciones:** la bandeja carga los 200 pedidos más recientes (sin paginación); la detección de duplicados antes de guardar es informativa y la garantía real son las reglas; ni el visor ni el borrado de comprobantes se probaron contra Drive real (`VITE_APPS_SCRIPT_URL` vacío); el aviso por WhatsApp abre `wa.me` con mensaje prellenado y el admin lo envía a mano; los cambios de estado posteriores a `adelanto_confirmado` (proveedor, envío, entrega) se hacen en las subtareas 11 y 13.
- **Status:** `[x] done`

### 11. Admin: pedidos a proveedor y notificaciones por WhatsApp
- **Intent:** consolidar lo pedido por los clientes y mantenerlos informados.
- **Expected Outcomes:**
  - Vista de camisas pedidas, agrupadas y con filtros.
  - Creación de un pedido a proveedor a partir de líneas seleccionadas.
  - Fecha estimada (~30 días, editable) y actualizaciones que se reflejan en los pedidos de clientes.
  - Mensajes `wa.me` prellenados por cliente.
- **Todo List:**
  1. Vista de líneas pendientes de pedir al proveedor (solo con adelanto confirmado).
  2. Crear `supplierOrders`: selección de líneas, nombre del proveedor, notas, costos y fecha estimada.
  3. Estados del pedido a proveedor (ej. pedido, en producción, enviado, llegó) con actualización de las líneas y de `orderTracking`.
  4. Subir actualizaciones y novedades al pedido a proveedor que se reflejan automáticamente en el rastreo de cada cliente afectado.
  5. Generar el enlace `wa.me` por cliente con mensaje editable: fecha estimada y aviso de que está sujeta a cambios.
  6. Exportar el pedido a proveedor a CSV.
- **Relevant Context:** `src/features/admin/supplier/*`, `src/services/supplierOrders.js`.
- **Notas de ejecución:** Lógica pura en `features/admin/supplier/supplier.js` (15 pruebas en `tests/supplier.test.js`): líneas pendientes (solo pedidos con adelanto confirmado, no cancelados y no incluidos ya en otro pedido a proveedor), resumen agrupado por camisa y talla, filtros, validación del formulario, armado del documento `supplierOrders` con costo total, `orderStatusFor` (un pedido de cliente avanza solo cuando TODAS sus camisas están en pedidos a proveedor y se queda en la etapa más atrasada: pedido/producción → `pedido_al_proveedor`, enviado → `en_camino`, llegó → `listo_para_entrega`; nunca retrocede ni toca cancelados o entregados), CSV con BOM que neutraliza fórmulas (`=`, `+`, `-`, `@`) y avisos `wa.me` con plantilla editable (`{nombre}`, `{pedido}`, `{estado}`, `{fecha}`, `{enlace}`) que advierte que la fecha puede cambiar. Servicio `services/supplierOrders.js`: `createSupplierOrder` y `updateSupplierOrder` escriben el pedido a proveedor, el estado de los pedidos de clientes, su rastreo (estado, fecha estimada e historial) y la bitácora en **un solo lote**. Admin: pestaña `Proveedor` (`/admin/proveedor`, `SupplierPage.jsx`): resumen de lo pendiente, búsqueda y filtro por talla, selección múltiple (también "elegir las mostradas"), costo unitario editable por línea (precargado del costo privado del producto), proveedor, notas y fecha estimada (30 días por defecto); lista de pedidos a proveedor con cambio de estado, fecha estimada, novedad visible al cliente, descarga CSV y panel de avisos por WhatsApp con un enlace por cliente. Reglas: sin cambios; 1 prueba nueva con el lote exacto de creación y actualización (admin sí, cliente no) y `npm run test:rules` pasa. `docs/data-model.md` actualizado. **Limitaciones:** un lote admite hasta 150 pedidos de clientes (límite de 500 escrituras de Firestore); `unitCost` se copia en el momento de crear, así que cambiar luego el costo del producto no altera pedidos pasados; no hay edición ni eliminación de las líneas de un pedido a proveedor ya creado (un error se corrige a mano en la consola de Firestore); los estados de cliente `entregado` y `cancelado` no los mueve esta pantalla; el rastreo público que lee estos datos llega en la subtarea 12; nada se probó contra Firestore real.
- **Status:** `[x] done`

### 12. Rastreo público e historial del cliente
- **Intent:** dar visibilidad al cliente, con o sin cuenta.
- **Expected Outcomes:**
  - Página `/rastreo` donde cualquiera consulta con su código de pedido.
  - Línea de tiempo de estados.
  - Módulo "Mis pedidos" para usuarios con Google.
- **Todo List:**
  1. Página de rastreo que lee `orderTracking/{code}` con `get`.
  2. Componente de línea de tiempo (pago en revisión, adelanto confirmado, pedido al proveedor, en camino, listo para entrega, entregado, cancelado).
  3. "Mis pedidos": lista y detalle desde `orders` filtrados por dueño, con paginación. Guardar las camisas pedidas como historial.
  4. Vincular a la cuenta de Google los pedidos hechos como invitado en el mismo dispositivo, si se puede hacer con seguridad (a validar).
- **Relevant Context:** `src/pages/Tracking.jsx`, `src/pages/MyOrders.jsx`, `src/features/tracking/*`, `src/services/tracking.js`, `src/components/StatusBadge.jsx`.
- **Notas de ejecución:** Lógica pura en `features/tracking/tracking.js` (15 pruebas en `tests/tracking.test.js`): `parseTrackingCode` (acepta el código solo o el enlace completo y rechaza lo que no cumple el formato de 20 a 64 caracteres de las reglas), `buildStages` (6 etapas hechas/actual/pendientes; el pago rechazado marca la primera etapa con problema y el cancelado no tiene etapas), historial ordenado, `normalizeTracking`, fecha estimada solo mientras el pedido sigue en curso y manejo de los pedidos guardados en el dispositivo (`parseSaved` ignora JSON dañado, `upsertSaved` sin duplicados y con tope de 20). Página pública `/rastreo` (`pages/Tracking.jsx`): campo para pegar el código o el enlace, consulta `orderTracking/{code}` con un solo `get` (sin cuenta), muestra las camisas del pedido, `TrackingTimeline` (etapas accesibles con texto oculto "completado / en curso / pendiente", fecha estimada con aviso de que puede cambiar, historial con las novedades del admin) y guarda el código en el dispositivo (`localStorage` `suchema.orders.v1`) con lista de "Pedidos en este dispositivo" para reabrirlos u olvidarlos; la confirmación del checkout guarda el código automáticamente. Enlaces compartibles: `main.jsx` convierte una entrada `/?pedido=CODIGO` en `/rastreo?pedido=CODIGO` y luego deja la barra de direcciones en el dominio. "Mis pedidos" (`/mis-pedidos`, `pages/MyOrders.jsx`): con Google lista los pedidos del usuario (consulta `where uid ==`, ordenada en el cliente para no necesitar índice) de 10 en 10 con estado, camisas, total, pagado, saldo, entrega y enlace al seguimiento; sin sesión o como invitado ofrece ingresar con Google y apunta al rastreo; se añadió el ícono "Mis pedidos" al menú de usuario del navbar. `StatusBadge` se extrajo de la pantalla admin a `components/StatusBadge.jsx` para reutilizarlo. Reglas: sin cambios (ya cubiertas por las pruebas de `get` público del rastreo y de la consulta del dueño por `uid`); `npm run test:rules` no se alteró. **Vincular pedidos de invitado:** al ingresar con Google desde una sesión anónima se usa `linkWithPopup`, que conserva el mismo `uid`, así que los pedidos hechos como invitado en ese dispositivo aparecen en "Mis pedidos" sin mover datos. **Limitaciones:** si esa cuenta de Google ya existía, Firebase inicia sesión en ella y el `uid` anónimo se abandona; esos pedidos solo se consultan con su código desde `/rastreo` (no se pueden reasignar con seguridad sin Functions); "Mis pedidos" carga hasta 100 pedidos y pagina en el cliente; el rastreo público no muestra precios ni datos personales por diseño; nada se probó contra Firestore real.
- **Status:** `[x] done`

### 13. Recibos PDF, QR y entrega
- **Intent:** confirmar que la camisa entregada es la correcta y cerrar el pedido.
- **Expected Outcomes:**
  - Recibo PDF por pedido (o por camisa) con detalle de talla, parches, nombre/número y QR.
  - Escáner de QR con la cámara en el admin.
  - Al escanear: verificación del contenido, cobro del saldo (SINPE o efectivo) y marca de entrega.
- **Todo List:**
  1. Generar el PDF en el navegador (librerías de PDF y QR) con el logo, el código del pedido, las líneas y el QR.
  2. El QR codifica el código del pedido y el identificador de línea.
  3. Escáner de QR con la cámara (PWA, móvil), con alternativa de ingreso manual del código.
  4. Pantalla de entrega: muestra lo esperado, registra el saldo cobrado y el método, marca la entrega y actualiza `orders` y `orderTracking`.
  5. Bitácora de la entrega.
- **Relevant Context:** `src/features/admin/receipts/*`, `src/features/admin/delivery/*`, `src/services/delivery.js`.
- **Notas de ejecución:** Lógica pura en `features/admin/delivery/delivery.js` (16 pruebas en `tests/delivery.test.js`): QR `SCFC:<orderId>:<lineIndex>`, `parseQrPayload` y `parseScanInput` (acepta el QR, el ID o la referencia corta de 8 caracteres), métodos de cobro (efectivo, SINPE, tarjeta), `deliveryBlock` (no se entrega un pedido cancelado, entregado o sin adelanto confirmado), `deliveryWarning`, `validateDelivery` (camisas marcadas, referencia SINPE obligatoria) y `applyDelivery`. Recibos en `features/admin/receipts/`: `buildReceiptModel` y `createReceiptPdf` (jsPDF + qrcode + logo oficial, cargado dinámicamente desde `OrdersPage`, que ahora tiene botones de recibo por pedido y por camisa). Escáner `QrScanner.jsx` con `BarcodeDetector` o `jsqr` y entrada manual. Pantalla `DeliveryPage.jsx` (`/admin/entrega`, pestaña `Entrega`): muestra lo esperado, cobra el saldo y marca la entrega. `services/delivery.js` (`fetchOrder`, `deliverOrder`) escribe orden, pago, `paymentRefs` si es SINPE, rastreo y bitácora en un solo lote. Reglas: sin cambios; 1 prueba nueva con el lote exacto de entrega (admin sí, cliente no, comprobante SINPE repetido no) y `npm run test:rules` pasa (194 pruebas). `docs/data-model.md` actualizado. lint, format:check, check:contrast, check:brand y build en verde. **Limitaciones:** cámara y PDF no probados en un dispositivo real; el PDF solo admite Latin-1 y no dibuja `₡` (usa "CRC"); el escáner exige HTTPS (o localhost); la referencia corta busca entre los 200 pedidos recientes; una entrega parcial por camisa no cambia el estado del pedido; Drive y Firestore reales sin probar.
- **Status:** `[x] done`

### 14. Reseñas y fotos de clientes
- **Intent:** generar confianza con prueba social moderada.
- **Expected Outcomes:**
  - Los clientes con Google dejan reseña (calificación, texto y fotos) en una camisa.
  - El admin aprueba o rechaza antes de publicar.
  - Reseñas visibles en el detalle del producto.
- **Todo List:**
  1. Formulario de reseña con carga de fotos vía Apps Script (`uploadReviewPhoto`).
  2. Cola de moderación en el admin y publicación.
  3. Mostrar promedio y listado paginado en el producto.
  4. Reglas para que solo se pueda crear una reseña propia y que no sea visible hasta aprobarse.
- **Relevant Context:** `src/features/reviews/*`, `src/features/admin/reviews/*`, `src/services/reviews.js`.
- **Notas de ejecución:** Lógica pura en `features/reviews/reviews.js` (4 pruebas en `tests/reviews.test.js`): ID `productId_uid`, `validateReview` (1 a 5 estrellas enteras, texto obligatorio de hasta 1000, hasta 4 fotos, nombre de Google presente), `buildReview` (siempre `approved: false`), `ratingSummary` (promedio a un decimal), `ratingBreakdown` y `sortReviews`. Servicio `services/reviews.js`: `listApprovedReviews` (consulta por `productId` + `approved == true`, sin índice compuesto), `getMyReview`, `createReview` (con `serverTimestamp`), `deleteMyReview`, `listPendingReviews`, `approveReview` y `rejectReview` (lote con bitácora y luego manda las fotos a la papelera de Drive sin bloquear si falla). Público: `ReviewsSection` en `Product.jsx` con promedio, desglose por estrellas, listado paginado de 5 en 5, fotos, formulario `ReviewForm` (estrellas accesibles con radios, contador, subida de hasta 4 fotos con `uploadReviewPhoto`) y estados: sin sesión o invitado → botón de Google; con reseña propia → aviso de pendiente/publicada y opción de borrarla para escribir otra. Admin: pestaña `Reseñas` (`/admin/resenas`, `ReviewsPage.jsx`) con la cola de moderación (aprobar o rechazar). Reglas: se separó `read` en `get` y `list` porque el dueño necesita consultar su reseña aunque aún no exista (el ID lleva su uid; antes habría dado permiso denegado en la primera reseña); `list` sigue exigiendo aprobada, dueño o admin. 2 pruebas de reglas nuevas (consulta del dueño y las consultas exactas de la app) y `npm run test:rules` pasa (200 pruebas). lint, format:check, check:contrast, check:brand y build en verde. **Limitaciones:** la subida de fotos y la moderación no se probaron contra Drive/Firestore reales; el cliente no puede editar una reseña (solo borrarla y reescribir); se cargan hasta 100 reseñas aprobadas por camisa; las fotos de reseñas aprobadas quedan en la carpeta pública de Drive; rechazar borra la reseña (no se guarda el motivo).
- **Status:** `[x] done`

### 15. Contenido informativo y botón de WhatsApp
- **Intent:** resolver dudas sin intervención manual.
- **Expected Outcomes:**
  - Páginas de Cómo comprar, Preguntas frecuentes, Políticas y Términos editables desde el admin.
  - Botón flotante de WhatsApp en todo el sitio.
- **Todo List:**
  1. Editor admin de contenido en `settings` (texto enriquecido simple o markdown).
  2. Renderizado de las páginas informativas.
  3. Explicar el adelanto del 50%, el plazo de ~30 días, el envío y los cambios o devoluciones (con valores desde `settings`).
  4. Botón flotante con el número y el mensaje por defecto editables.
- **Relevant Context:** `src/pages/Help.jsx`, `src/features/content/*`, `src/features/admin/content/*`, `src/services/content.js`, `src/components/{WhatsAppButton,RichText}.jsx`.
- **Notas de ejecución:** Lógica pura en `features/content/content.js` (7 pruebas en `tests/content.test.js`): textos iniciales (`DEFAULT_CONTENT`) con marcadores `{adelanto}`, `{plazo}` y `{tarifa}`, `normalizeContent` (ignora datos inválidos y respeta una lista de preguntas vacía), `templateVars` y `fillTemplate` (el adelanto sale de `settings/payment`, la tarifa de `settings/shipping` y el plazo de `settings/content.leadDays`), `parseBlocks` y `parseInline` (texto simple: `## Título`, listas con `- ` o `1. `, `**negrita**`, párrafos), `validateContent` y `buildContentDoc`. `components/RichText.jsx` dibuja esos bloques como elementos de React, **sin `dangerouslySetInnerHTML`**, así que el HTML escrito en el editor se muestra como texto. `services/content.js`: `loadContentBundle` (4 lecturas de `settings`), `loadWhatsApp` (2 lecturas) y `saveContent` (con bitácora). Público: `pages/Help.jsx` ahora lee `settings/content` y muestra Cómo comprar, Preguntas frecuentes, Envíos y entrega, Cambios y devoluciones y Términos y condiciones (nueva), más un enlace de WhatsApp al final. `WhatsAppButton.jsx` toma el número de `settings/general.whatsappNumber` (el mismo campo de Ajustes) y el mensaje de `settings/content.whatsappMessage`; `VITE_WHATSAPP_NUMBER` queda solo como respaldo. Admin: pestaña `Contenido` (`/admin/contenido`, `ContentPage.jsx`) con un editor por sección, vista previa, preguntas frecuentes agregables y quitables (hasta 30), mensaje de WhatsApp y plazo en días. Reglas: sin cambios (`settings` ya es lectura pública y escritura de admin). lint, format:check, check:contrast, check:brand y build en verde. **Limitaciones:** el texto no admite enlaces, imágenes ni cursiva; no hay historial de versiones del contenido; las páginas son subsecciones de `/ayuda` (no rutas separadas, por la decisión de ruta única); el botón de WhatsApp hace 2 lecturas por visita a la app y cada visita a Ayuda hace 4; no se probó con Firestore real.
- **Status:** `[x] done`

### 16. Admin: dashboard, costos y herramientas operativas
- **Intent:** visibilidad del negocio y respaldo manual.
- **Expected Outcomes:**
  - Dashboard con pedidos por estado, pagos por revisar, camisas más pedidas e ingresos.
  - Costo y margen por camisa.
  - Visor de bitácora de auditoría.
  - Exportación CSV/JSON (catálogo, pedidos y clientes) como respaldo.
- **Todo List:**
  1. Dashboard con consultas acotadas (agregados por periodo) para cuidar las cuotas de lectura.
  2. Informe de costos y márgenes a partir de `productPrivate` y las líneas de pedido.
  3. Pantalla de bitácora con filtros.
  4. Exportadores CSV/JSON.
- **Relevant Context:** `src/features/admin/dashboard/*`, `src/features/admin/audit/*`, `src/services/reports.js`.
- **Notas de ejecución:** Lógica pura (13 pruebas en `tests/dashboard.test.js`). `features/admin/dashboard/stats.js`: periodos (7, 30, 90 días y todo), `isSale` (cuenta como venta el pedido con adelanto confirmado o más avanzado, no cancelado), `countStatuses`, `productReport` (cantidad, ingresos, costo, margen y % por camisa; sin costo registrado queda en `null`, no en cero) y `summarize` (ventas, cobrado, saldo por cobrar, descuentos, envío, promedio y margen total). `exports.js`: `ordersCsv`, `customersCsv` (agrupa por teléfono sin contar cancelados), `catalogCsv`, `toJson` con los Timestamp convertidos a ISO, y `backupName` con fecha; reutilizan `csvCell` del proveedor, que neutraliza fórmulas. `features/admin/audit/audit.js`: filtros de la bitácora por acción, colección, texto, y rango de fechas. Servicio `services/reports.js`: `listOrdersSince` (una consulta con `createdAt >= inicio`, orden descendente y tope de 500), `loadCosts` (`productPrivate`), `listAudit` (100 por página con cursor por fecha) y `listAllOrders` (de 500 en 500, tope de 5000). Pantallas admin: `Resumen` (`/admin/resumen`, ahora inicio de `/admin`): pagos por revisar, pedidos en curso, ventas, cobrado, pedidos por estado y tabla de costos y márgenes por camisa; `Bitácora` (`/admin/bitacora`): últimas 100 entradas con filtros y "Cargar anteriores"; `Respaldo` (`/admin/respaldo`): descarga CSV y JSON de pedidos, clientes y catálogo. Cuotas: el Resumen lee como máximo 500 pedidos + las filas de `productPrivate` por visita, y avisa en pantalla si llegó al tope. Reglas: sin cambios; 1 prueba nueva con las consultas exactas del dashboard y la bitácora (admin sí, cliente no) y `npm run test:rules` pasa (221 pruebas en 13 archivos). lint, format:check, check:contrast, check:brand y build en verde. **Limitaciones:** las cifras del Resumen se calculan en el navegador y no son agregados guardados (con más de 500 pedidos en el periodo son parciales); si la consulta por `createdAt` pide un índice, Firestore indica el enlace para crearlo al primer uso real (campo único, normalmente automático); el costo no incluye parches ni personalización; el pedido a proveedor tiene su propio costo (`supplierOrders.totalCost`) que no se cruza aquí; "clientes" sale de los pedidos (no incluye a quien solo inició sesión); no se probó con Firestore real.
- **Status:** `[x] done`

### 17. PWA, SEO y rendimiento
- **Intent:** que el sitio se instale, cargue rápido y se comparta bien.
- **Expected Outcomes:**
  - PWA instalable con caché de recursos y página sin conexión.
  - Etiquetas SEO y Open Graph para que los enlaces se vean bien en WhatsApp e Instagram.
  - Rendimiento optimizado en móvil.
- **Todo List:**
  1. Configurar `vite-plugin-pwa` (manifest, íconos, service worker y actualización).
  2. Etiquetas SEO por página (título, descripción y canonical) y un `sitemap.xml`.
  3. Open Graph: estáticas para todo el sitio. Para vistas previas por camisa se prepara un script de **prerender en build** que lee Firestore y genera HTML estático por producto. Se ejecuta de forma manual antes de cada despliegue (ver pregunta abierta 2).
  4. Carga diferida de rutas, imágenes con tamaños responsivos y `loading="lazy"`.
  5. Revisión con Lighthouse en móvil.
- **Relevant Context:** `vite.config.js`, `scripts/prerender.mjs`, `src/features/seo/*`, `src/utils/entry.js`, `src/hooks/{usePageMeta,useRouteMeta}.js`, `public/robots.txt`.
- **Notas de ejecución:** **PWA:** `vite-plugin-pwa` 2.0 (compatible con Vite 8) en `vite.config.js`: manifest (`SuChemaFC`, fondo y tema `#000000`, íconos 192, 512 y maskable ya existentes), service worker `autoUpdate`, precaché de la app (75 archivos, ~2,7 MB) con `navigateFallback` a `/index.html` (sin conexión abre la app) y caché `CacheFirst` de las fotos de Drive (150 imágenes, 30 días). Las librerías pesadas que solo usa el admin (jsPDF, html2canvas, jsQR, purify, escáner y entrega) se excluyen del precaché para no descargar ~1 MB al instalar. **Rendimiento:** todas las pantallas excepto la portada, el layout y la guardia de admin cargan bajo demanda (`React.lazy` en `App.jsx`): el paquete principal pasó de 1.169 kB a 325 kB (103 kB gzip). Se creó `src/assets/logo-small.png` (160 px, 38 kB) que `Logo` usa en los tamaños `sm`, `nav` y `md`; el original de 375 kB se conserva para `lg`, `xl`, recibos PDF y Open Graph. `firebase.json`: `sw.js` sin caché y `/assets/**` con caché inmutable de un año. **SEO:** `features/seo/seo.js` (12 pruebas en `tests/seo.test.js`): títulos por pantalla (`usePageMeta` y `useRouteMeta`; las camisas ponen su nombre y precio en la descripción), `buildProductMeta`, `renderProductHtml` (reemplaza title, description, canonical, og:* y twitter:* con todo escapado), `buildSitemap` y `buildRobots`. **Open Graph por camisa:** `npm run prerender` (`scripts/prerender.mjs`) lee las camisas visibles con la API REST de Firestore (`runQuery`, sin firebase-admin ni credenciales, solo lo que ya permiten las reglas), escribe `dist/p/<id>/index.html` con su título, descripción, precio e imagen de Drive, reescribe la portada con URLs absolutas y genera `sitemap.xml` y `robots.txt`. `npm run deploy` ahora corre build + prerender + deploy. Se ejecutó contra el proyecto real: funciona, y generó 0 páginas porque aún no hay camisas publicadas. **Enlaces compartibles:** `utils/entry.js` convierte `/p/<id>/` y `/?producto=<id>` en el detalle de la camisa (el ID se valida contra `[A-Za-z0-9_-]{1,64}`, y `/?pedido=` sigue abriendo el rastreo); el detalle tiene el botón "Copiar enlace" que usa `/p/<id>/`, la página con vista previa. **Lighthouse móvil (build de producción en local):** accesibilidad 100, buenas prácticas 100, SEO 100 (el único fallo, `robots.txt` inválido, se corrigió con `public/robots.txt`), rendimiento 100 sin simulación de red y 81 con la simulación de red lenta de Lighthouse (LCP 5,1 s, que mide el logo del navbar mientras se descarga `iframe.js` de Firebase Auth, ~1,2 s, antes de pintar). **Limitaciones:** el prerender es manual (hay que ejecutarlo antes de cada despliegue y no refleja camisas nuevas hasta entonces); Lighthouse se midió contra `vite preview` en local, no contra Hosting (HTTP/2, compresión y CDN pueden cambiar los tiempos); no se probó la instalación en un teléfono ni el modo sin conexión en un dispositivo real; sin conexión solo se ven las pantallas con datos ya cargados (Firestore tiene su propia caché local); el LCP depende de que Firebase Auth cargue su iframe, y diferirlo cambiaría cómo arranca la sesión (no se tocó); los ajustes de `SITE_URL` deben apuntar al dominio final si se usa uno propio.
- **Status:** `[x] done`

### 18. Pruebas, endurecimiento y despliegue
- **Intent:** validar el sistema completo y publicarlo.
- **Expected Outcomes:**
  - Pruebas unitarias de lógica crítica (precios, cupones, pagos) y de reglas de Firestore.
  - Recorrido de extremo a extremo documentado (compra como invitado, revisión de pago, pedido a proveedor, entrega).
  - Despliegue en Firebase Hosting con las reglas publicadas.
- **Todo List:**
  1. Pruebas de las funciones puras y de las reglas con el emulador.
  2. Revisión de seguridad: acceso a datos privados, enumeración de pedidos y subida de archivos.
  3. Verificar el uso de cuotas de Spark y ajustar consultas.
  4. Desplegar Hosting y reglas, y documentar el flujo operativo para el admin.
- **Relevant Context:** `docs/operacion.md`, `.env.example`, `firebase.json`, `firestore.rules`, `apps-script/Code.gs`, `tests/firestore.rules.test.js`, `src/services/{content,orders,supplierOrders,drive}.js`.
- **Notas de ejecución:** **Pruebas:** `npm run test:rules` pasa con **14 archivos y 236 pruebas** (3 nuevas: colecciones no declaradas denegadas incluso al admin, nadie se auto-promueve a admin, validación de fotos de reseñas). Las funciones puras críticas (precios, cupones, pagos, checkout, entrega, estados) ya tenían pruebas desde las subtareas 5 a 16. **Revisión de seguridad** (detalle en `docs/operacion.md` §4): se leyeron todas las reglas y `Code.gs`. Hallazgos corregidos: (1) `reviews.photos` solo validaba el tamaño de la lista; ahora cada posición (máx. 4) debe ser texto de 1 a 100 caracteres (`validPhotos` en `firestore.rules`); (2) `Code.gs` permitía subidas ilimitadas a cualquier sesión, incluida la anónima; ahora `checkRateLimit_` limita a 10 subidas por hora por usuario no admin con `CacheService` (nuevo mensaje `demasiadas_solicitudes` en `services/drive.js`). Sin hallazgos: enumeración de pedidos (`orderTracking` solo `get` con código de 128 bits y sin datos personales; `orders` solo dueño/admin con filtro por `uid`), datos privados, rol admin, secretos (`.env` ignorado) y contenido enriquecido. Riesgos aceptados y documentados: precios del pedido no verificables por las reglas, pedidos falsos de anónimos, lectura pública de `settings`, límite de subidas relajable si Google vacía la caché y fotos de reseñas públicas en Drive antes de aprobarse. **Cuotas de Spark:** tabla de lecturas por pantalla en `docs/operacion.md` §5. Ajustes: `loadWhatsApp` se guarda 5 minutos en memoria (se limpia al guardar ajustes o contenido), con lo que baja de 2 lecturas por carga a 2 cada 5 minutos; `listSupplierOrders` ahora tiene tope de 200 (antes sin límite). **Despliegue y operación:** `docs/operacion.md` (puesta en marcha, despliegue, flujo diario, seguridad, cuotas, lista de verificación de extremo a extremo y limitaciones), `.env.example` creado (el README lo mencionaba pero no existía) y README actualizado. Se comprobó con `firebase deploy --only firestore --dry-run` que las reglas compilan contra el proyecto real `suchemafc`. Lint, format:check, check:contrast, check:brand y build en verde. **Limitaciones:** **no se publicaron las reglas ni el hosting**: requiere tu autorización y credenciales (comandos en `docs/operacion.md` §1 y §2); hay que volver a implementar el Web App de Apps Script para que aplique el límite de subidas; el recorrido de extremo a extremo quedó como lista de verificación porque Drive y Firestore reales nunca se probaron desde el código (`VITE_APPS_SCRIPT_URL` vacío, sin `admins/{uid}` ni `settings/payment`).
- **Status:** `[x] done`

---

## Decisiones cerradas
- **Estilos:** Tailwind CSS.
- **Open Graph por producto:** prerender manual en build antes de cada despliegue (subtarea 17).
- **Marca:** nombre final **SuChemaFC**. Paleta **negro con dorado y detalles en blanco** (reemplaza la idea anterior de celeste). Eslogan del logo: "Tu equipo, tus colores, tu pasión". El logo (emblema circular con camiseta negra de ribetes dorados, texto "SuChema" en blanco y "FC" en dorado, balón) se usa en toda la web app.
- **Navbar:** siempre **negro**, en modo claro y oscuro. Logo, enlaces e íconos en dorado (y blanco para texto secundario), con borde inferior dorado.
- **Contraste:** todas las combinaciones de texto, fondo, botones, enlaces, estados de foco y errores deben cumplir **WCAG AA** (4.5:1 texto normal, 3:1 texto grande y componentes de interfaz) en ambos temas.
- **Ruta única:** la barra de direcciones siempre muestra solo el dominio (sin `/catalogo`, `/ayuda`, etc.). `src/main.jsx` usa `MemoryRouter`: la navegación interna sigue funcionando con `Link`/`NavLink`, pero no escribe en la URL. Consecuencias aceptadas: el botón Atrás del navegador sale de la app en vez de volver a la pantalla anterior, no se puede compartir ni guardar el enlace de un producto o pedido, y al recargar se vuelve al inicio. Un enlace directo que ya traiga ruta (por ejemplo uno viejo a `/rastreo`) se lee una vez al entrar y luego se oculta. Por eso el rastreo (subtarea 12) y los enlaces compartibles de producto (subtarea 17) deberán usar parámetros que se lean al entrar (por ejemplo `?pedido=CODIGO`) en lugar de rutas.
- **Temas:** modo claro y modo oscuro, con el **oscuro por defecto**. El oscuro debe ser **100% negro** (`#000000` de fondo, sin grises azulados). Las superficies elevadas usan grises neutros puros, sin matiz azul. Se implementa con tokens de color en Tailwind (`darkMode: 'class'`), con la preferencia guardada en localStorage.
- **Versiones de una camisa (posterior al plan original):** una camisa puede tener `variants[]` (Hombre / Mujer / Niño…) con precio, fotos, tallas visibles, recargos, parches, personalización, tabla de tallas, costo (`productPrivate.variantCosts`) y oferta propios; lo que no define lo hereda de la base (`resolveVariant`). **Las ofertas no se heredan:** `sale` de la camisa aplica solo a la versión base. Cada versión define sus tallas (`sizes`; niño 16–28 sin recargo). Cada unidad del carrito elige su versión y talla (`variantId` en la línea de carrito y de pedido; `name` del pedido = "Camisa · Versión"). Catálogo: "desde ₡X". Sin cambios en `firestore.rules`. Detalle en `docs/data-model.md` y `variantes-plan.md`.

## Sistema de diseño y contraste
- **Tokens base (valores iniciales, se afinan al verificar contraste y contra el color real del logo):**
  - Oscuro: fondo `#000000`; superficies en grises neutros (`#0A0A0A`, `#141414`, `#1F1F1F`); texto `#FFFFFF` y secundario neutro claro; acento dorado (~`#D4AF37`) para botones primarios, enlaces y foco.
  - Claro: fondo blanco; texto casi negro; superficies grises neutros claros. El dorado puro tiene poco contraste sobre blanco, así que para texto o íconos dorados sobre fondo claro se usa un **dorado oscuro** (bronce) y el dorado brillante queda para fondos con texto negro (botones, navbar, insignias).
  - Navbar: fondo negro `#000000` fijo, idéntico en ambos temas, con texto/íconos dorados o blancos y borde inferior dorado, lo que lo separa del contenido tanto en modo claro como oscuro.
- **Pares permitidos:** negro sobre dorado (botones, insignias), blanco sobre negro, dorado sobre negro (navbar, enlaces, foco) y negro sobre blanco. Se evitan blanco sobre dorado y dorado claro sobre blanco.
- **Verificación:** la subtarea 0 crea una página interna de pruebas de diseño que muestra todos los tokens y pares, y un script de comprobación de contraste que falla si algún par queda por debajo de AA. También comprueba que el navbar sea negro en ambos temas y que no se use ningún color fuera de la paleta. Se vuelve a revisar con Lighthouse en la subtarea 17.
- **Estados:** foco visible con anillo de alto contraste, botones deshabilitados legibles, y errores o éxitos que no dependan solo del color.
- **Imágenes de producto:** las fotos de camisas se muestran sobre un fondo neutro para que se vean bien en ambos temas.

## Pregunta abierta
- **Vincular pedidos de invitado a una cuenta de Google:** se evalúa en la subtarea 12 (solo si se puede hacer con seguridad).

## Datos que el usuario entregará durante la ejecución
- Configuración web de Firebase.
- IDs de carpetas de Drive (pública y privada) y URL del Web App de Apps Script.
- Número de WhatsApp, datos de SINPE, tarifas y textos de envío y entrega.
- Primer UID de admin.
