# Apps Script: puente a Google Drive y correos

El proyecto de Apps Script es **un solo archivo**, [`apps-script/Code.gs`](../apps-script/Code.gs) (Drive, verificación de sesión, eliminar usuarios y correos). Reciben imágenes desde la web app y las guardan en Google Drive (para no usar Firebase Storage, no disponible en el plan Spark) y envían los avisos por correo.

## Qué hace

| Acción                  | Quién puede usarla                    | Destino                                                          |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `uploadCatalogImage`    | admin                                 | carpeta **pública**                                              |
| `uploadReviewPhoto`     | usuario con Google                    | carpeta **pública** (la reseña queda pendiente de moderación)    |
| `uploadReceipt`         | cualquier sesión, incluida la anónima | carpeta **privada**                                              |
| `getReceipt`            | admin                                 | lee un archivo de la carpeta privada                             |
| `deleteFile`            | admin                                 | manda a la papelera un archivo de cualquiera de las dos carpetas |
| `deleteUser`            | admin                                 | elimina la cuenta de acceso (Firebase Auth) de un usuario        |
| `notifyOrderCreated`    | dueño del pedido                      | correo a `crsuchema@gmail.com` y al cliente                      |
| `notifyPaymentApproved` | admin                                 | correo al cliente: adelanto aprobado (con el recibo adjunto, PNG) |
| `notifySupplierUpdate`  | admin                                 | correo a cada cliente con camisas en ese pedido al proveedor     |

En cada petición el script verifica el ID token de Firebase (API REST de Identity Toolkit). Para las acciones de admin comprueba que el correo sea el del admin fijo (`crsuchema@gmail.com`, verificado) o que exista `admins/{uid}` en Firestore, leyéndolo con el token del propio usuario; no se usan credenciales de servicio. El resultado de ambas verificaciones se guarda 2 minutos en caché para ahorrar llamadas.

Otras protecciones: solo JPG, PNG y WebP (se valida el tipo y la firma del archivo), máximo 4 MB, nombres de archivo generados por el script, `getReceipt`/`deleteFile` limitados a archivos dentro de las carpetas configuradas, y un máximo de 10 subidas y 10 correos por hora por usuario no admin. El contenido de los correos se lee de Firestore con el token de quien llama (nadie puede mandar texto arbitrario) y no se repiten correos iguales (caché de 6 h).

## Pasos de despliegue (los hace el dueño del negocio)

Las carpetas del negocio (Chemas/Catálogo y Comprobantes), el proyecto `suchemafc`, el correo del admin fijo y el dominio `https://suchemafc.web.app` ya vienen como valores por defecto en `DEFAULTS` de `Code.gs`. También trae la clave web pública de Firebase, así que **no hay que definir ninguna propiedad del script**.

1. **Crear el proyecto de Apps Script** con la cuenta de Google dueña de las carpetas, en <https://script.google.com> > Nuevo proyecto. Borra el contenido de `Code.gs` y pega completo `apps-script/Code.gs`. Opcional: en Configuración del proyecto activa "Mostrar el archivo de manifiesto appsscript.json" y pega `apps-script/appsscript.json`; el permiso `cloud-platform` que añade solo se necesita para eliminar usuarios.
2. **Propiedades del script (opcionales):** solo si quieres cambiar algo de `DEFAULTS` (Configuración del proyecto > Propiedades del script):

   | Propiedad             | Valor                                                | Obligatoria |
   | --------------------- | ---------------------------------------------------- | ----------- |
   | `FIREBASE_API_KEY`    | la misma clave que `VITE_FIREBASE_API_KEY`           | sí          |
   | `PUBLIC_FOLDER_ID`    | otra carpeta pública distinta a la de `DEFAULTS`     | no          |
   | `PRIVATE_FOLDER_ID`   | otra carpeta privada distinta a la de `DEFAULTS`     | no          |
   | `FIREBASE_PROJECT_ID` | otro ID de proyecto Firebase                         | no          |
   | `SITE_URL`            | dominio público si no es `https://suchemafc.web.app` | no          |

3. **Implementar como aplicación web:** Implementar > Nueva implementación > Aplicación web.
   - Ejecutar como: **yo**.
   - Quién tiene acceso: **cualquier usuario** (la identidad se verifica con el token de Firebase).
   - Autoriza los permisos de Drive, correo y peticiones externas cuando Google los pida.
4. **Copiar la URL de la aplicación web** (termina en `/exec`) y ponerla en `.env` como `VITE_APPS_SCRIPT_URL`.
5. **Probar:** abrir la URL en el navegador debe mostrar `{"ok":true,"service":"suchemafc-drive"}`.

Cada vez que cambies `Code.gs`, crea una **nueva versión** de la implementación (Implementar > Administrar implementaciones > editar > Nueva versión). La URL no cambia.

## Notas importantes

- **Cuotas:** Apps Script tiene límites diarios de ejecución y de llamadas a URL externas (cada petición hace una o dos). Una cuenta personal de Gmail envía unos **100 correos al día** con `MailApp`: cada pedido nuevo son 2 correos y cada novedad al proveedor es 1 por cliente. Si se supera, el aviso falla sin afectar el pedido. Las imágenes se comprimen en el navegador (máx. 1600 px, WebP) para mantener las subidas livianas.
- **Prerrequisito de reglas:** la comprobación de admin depende de que `firestore.rules` permita leer `admins/{uid}` al propio usuario (ya lo hace). Hay que volver a publicar las reglas: `npx firebase-tools deploy --only firestore:rules`.
- **Eliminar usuarios (`deleteUser`):** usa `ScriptApp.getOAuthToken()` con el permiso `cloud-platform`. La cuenta dueña del script debe tener rol de Propietario o Editor en el proyecto Firebase `suchemafc`; si no, la acción responde `no_se_pudo_eliminar` y el panel no borra nada. Esto no se probó en producción. No se puede eliminar al admin fijo ni a uno mismo.
- **Correos son de mejor esfuerzo:** si el script falla o se agotó la cuota, el pedido o el cambio de estado se guarda igual y la app avisa que el correo no se envió.
- **Imágenes públicas:** se muestran con `https://lh3.googleusercontent.com/d/{id}=w{ancho}` (ver `driveImageUrl` en `src/services/drive.js`). Si Google cambia ese formato, solo hay que ajustar esa función.
- **Comprobantes:** al verificar el pago, el admin guarda el número de comprobante y la app llama a `deleteFile`. El archivo va a la papelera de Drive (se elimina definitivamente a los 30 días o al vaciarla).
- **Errores esperados:** el script responde `{ ok: false, error: "codigo" }`. Los códigos (`no_autenticado`, `no_autorizado`, `tipo_no_permitido`, `archivo_muy_grande`, etc.) los traduce `DriveError` en el cliente.
