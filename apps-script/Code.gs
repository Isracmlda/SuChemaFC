/**
 * Puente entre SuChemaFC, Google Drive, correo y cuentas (Web App de Apps Script).
 * Es UN solo archivo: pégalo completo en Code.gs. Despliegue: ver docs/apps-script-setup.md.
 *
 * Carpetas de Drive (ya configuradas abajo; se pueden sobrescribir con Propiedades del script):
 *   Chemas (Catálogo) - pública:  https://drive.google.com/drive/folders/1y0XvIKdnmDCT-DVVYoEEIq2fy2Sx6tii
 *   Comprobantes      - privada:  https://drive.google.com/drive/folders/1BOAdlpX8zrTByWEqmcZ4_mc36z_oK88s
 *
 * Todo viene configurado en DEFAULTS; no hace falta definir propiedades del script (si existen,
 * tienen prioridad: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, PUBLIC_FOLDER_ID, PRIVATE_FOLDER_ID,
 * ADMIN_EMAIL, SITE_URL).
 *
 * Protocolo: POST con Content-Type text/plain (evita el preflight de CORS) y cuerpo JSON:
 *   { action, idToken, ...parámetros }
 * Respuesta: JSON { ok: true, ...datos } o { ok: false, error: 'codigo' }.
 *
 * Seguridad: el ID token de Firebase se verifica en cada petición (con caché de 2 minutos para
 * ahorrar llamadas). Las acciones de admin exigen ser el admin fijo (ADMIN_EMAIL) o tener
 * admins/{uid} en Firestore, leído con el propio token del usuario.
 */

var DEFAULTS = {
  PUBLIC_FOLDER_ID: '1y0XvIKdnmDCT-DVVYoEEIq2fy2Sx6tii',
  PRIVATE_FOLDER_ID: '1BOAdlpX8zrTByWEqmcZ4_mc36z_oK88s',
  FIREBASE_PROJECT_ID: 'suchemafc',
  FIREBASE_API_KEY: 'AIzaSyA-ZzD6HmBgr_z0GLWF8v_Lx-pU6N6iHnY', // clave web pública de Firebase
  ADMIN_EMAIL: 'crsuchema@gmail.com',
  SITE_URL: 'https://suchemafc.web.app',
};

var SCRIPT_VERSION = 6; // súbela al cambiar el código: doGet la muestra y sirve para saber qué versión está activa

var MAX_BYTES = 4 * 1024 * 1024; // tamaño máximo del archivo decodificado
var RATE_LIMITS = { upload: 10, mail: 10 }; // acciones por usuario no admin dentro de la ventana
var RATE_WINDOW_SEC = 3600; // ventana de 1 hora
var TOKEN_CACHE_SEC = 120; // cuánto se recuerda un token ya verificado
var ADMIN_CACHE_SEC = 120; // cuánto se recuerda el rol de admin de un usuario
var ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
var EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Cada acción: quién puede usarla, su límite (solo no admin) y la función que la atiende.
// Las de correo se envuelven en funciones para no depender del orden de las declaraciones.
var ACTIONS = {
  uploadCatalogImage: { role: 'admin', handler: uploadCatalogImage_ },
  uploadReviewPhoto: { role: 'google', limit: 'upload', handler: uploadReviewPhoto_ },
  uploadReceipt: { role: 'session', limit: 'upload', handler: uploadReceipt_ },
  getReceipt: { role: 'admin', handler: getReceipt_ },
  deleteFile: { role: 'admin', handler: deleteFile_ },
  deleteUser: { role: 'admin', handler: deleteUser_ },
  notifyOrderCreated: {
    role: 'session',
    limit: 'mail',
    handler: function (b, u) { return notifyOrderCreated_(b, u); },
  },
  notifyPaymentApproved: {
    role: 'admin',
    handler: function (b, u) { return notifyPaymentApproved_(b, u); },
  },
  notifySupplierUpdate: {
    role: 'admin',
    handler: function (b, u) { return notifySupplierUpdate_(b, u); },
  },
};

function doPost(e) {
  try {
    var body = parseBody_(e);
    var action = ACTIONS[body.action];
    if (!action) return json_({ ok: false, error: 'accion_invalida' });

    var user = verifyIdToken_(body.idToken);
    if (!user) return json_({ ok: false, error: 'no_autenticado' });

    if (action.role === 'google' && user.isAnonymous) {
      return json_({ ok: false, error: 'requiere_google' });
    }
    if (action.role === 'admin' && (user.isAnonymous || !isAdmin_(user, body.idToken))) {
      return json_({ ok: false, error: 'no_autorizado' });
    }

    if (action.role !== 'admin' && action.limit) checkRateLimit_(user.uid, action.limit);

    return json_(action.handler(body, user));
  } catch (err) {
    // Los errores esperados lanzan Error('codigo'); cualquier otro se oculta al cliente.
    var code = String(err && err.message ? err.message : '');
    var known = /^[a-z_]+$/.test(code);
    if (!known) console.error('doPost: ' + (err && err.stack ? err.stack : err));
    // `detail` solo acompaña a los errores inesperados, para poder diagnosticarlos desde el navegador.
    return json_({
      ok: false,
      error: known ? code : 'error_interno',
      detail: known ? undefined : code.slice(0, 300),
    });
  }
}

/**
 * Ejecútala UNA vez desde el editor (selecciónala arriba y pulsa Ejecutar) para que Google pida
 * los permisos de Drive, correo y servicios externos. Después crea una nueva versión de la
 * implementación. No modifica nada: solo lee las carpetas y consulta el estado del correo.
 */
function autorizar() {
  var publica = DriveApp.getFolderById(prop_('PUBLIC_FOLDER_ID')).getName();
  var privada = DriveApp.getFolderById(prop_('PRIVATE_FOLDER_ID')).getName();
  var correosRestantes = MailApp.getRemainingDailyQuota();
  var red = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/', {
    muteHttpExceptions: true,
  }).getResponseCode();
  var token = ScriptApp.getOAuthToken() ? 'ok' : 'sin token';
  console.log(
    'Permisos OK. Carpetas: "' + publica + '" y "' + privada + '". Correos disponibles hoy: ' +
      correosRestantes + '. Red: ' + red + '. Token: ' + token,
  );
}

/**
 * Ejecútala UNA vez desde el editor: deja Chemas pública de solo lectura (Lector) y Comprobantes
 * privada. Usa la misma llamada setSharing que la subida de imágenes, así que si falla aquí el
 * mensaje del registro dice exactamente por qué Drive lo niega.
 */
function configurarCarpetas() {
  var publica = DriveApp.getFolderById(prop_('PUBLIC_FOLDER_ID'));
  publica.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var privada = DriveApp.getFolderById(prop_('PRIVATE_FOLDER_ID'));
  privada.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  console.log(
    'Chemas: ' + publica.getSharingAccess() + ' / ' + publica.getSharingPermission() +
      '. Comprobantes: ' + privada.getSharingAccess() + '.',
  );
}

function doGet() {
  return json_({ ok: true, service: 'suchemafc-drive', version: SCRIPT_VERSION });
}

/**
 * Limita las acciones de usuarios que no son admin (anónimos y Google) para que nadie llene el
 * Drive del dueño ni agote la cuota de correos. Ventana fija por uid y por tipo de acción
 * guardada en CacheService (se pierde si Google la vacía, lo que solo relaja el límite).
 */
function checkRateLimit_(uid, scope) {
  var cache = CacheService.getScriptCache();
  var key = 'rl_' + scope + '_' + uid;
  var count = parseInt(cache.get(key) || '0', 10);
  if (count >= RATE_LIMITS[scope]) throw new Error('demasiadas_solicitudes');
  // put reinicia el TTL: la ventana se renueva con cada acción, lo que es aún más estricto.
  cache.put(key, String(count + 1), RATE_WINDOW_SEC);
}

// ---------- Acciones de archivos ----------

function uploadCatalogImage_(body) {
  return { ok: true, fileId: saveImage_(prop_('PUBLIC_FOLDER_ID'), 'catalogo', body, true) };
}

function uploadReviewPhoto_(body, user) {
  return {
    ok: true,
    fileId: saveImage_(prop_('PUBLIC_FOLDER_ID'), 'resena-' + user.uid.slice(0, 8), body, true),
  };
}

function uploadReceipt_(body, user) {
  return {
    ok: true,
    fileId: saveImage_(prop_('PRIVATE_FOLDER_ID'), 'comprobante-' + user.uid.slice(0, 8), body, false),
  };
}

function getReceipt_(body) {
  var file = getFileInFolder_(body.fileId, prop_('PRIVATE_FOLDER_ID'));
  var blob = file.getBlob();
  return {
    ok: true,
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes()),
  };
}

function deleteFile_(body) {
  // Solo archivos que estén dentro de nuestras carpetas: el script corre con la cuenta del
  // dueño y, sin esta comprobación, podría borrar cualquier archivo de su Drive.
  var file = getFileInAnyFolder_(body.fileId);
  file.setTrashed(true);
  return { ok: true };
}

// ---------- Acción de usuarios ----------

/**
 * Elimina la cuenta de acceso (Firebase Auth) de un usuario. Usa el token OAuth del dueño del
 * script, que debe ser propietario del proyecto de Firebase. El perfil de Firestore lo borra la app.
 * Nunca elimina al admin fijo ni a quien hace la petición.
 */
function deleteUser_(body, user) {
  var uid = String(body.uid || '');
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new Error('id_invalido');
  if (uid === user.uid) throw new Error('no_puedes_eliminarte');

  var project = prop_('FIREBASE_PROJECT_ID');
  var base =
    'https://identitytoolkit.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/accounts:';
  var options = function (payload) {
    return {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': project },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };
  };

  var lookup = UrlFetchApp.fetch(base + 'lookup', options({ localId: [uid] }));
  if (lookup.getResponseCode() !== 200) throw new Error('no_se_pudo_eliminar');
  var found = JSON.parse(lookup.getContentText()).users;
  if (!found || !found.length) return { ok: true, deleted: false }; // ya no existe
  if (String(found[0].email || '').toLowerCase() === adminEmail_()) {
    throw new Error('usuario_protegido');
  }

  var res = UrlFetchApp.fetch(base + 'delete', options({ localId: uid }));
  if (res.getResponseCode() !== 200) throw new Error('no_se_pudo_eliminar');
  CacheService.getScriptCache().remove('adm_' + uid);
  return { ok: true, deleted: true };
}

// ---------- Drive ----------

function saveImage_(folderId, prefix, body, makePublic) {
  var mime = String(body.mimeType || '');
  if (ALLOWED_MIME.indexOf(mime) === -1) throw new Error('tipo_no_permitido');
  if (typeof body.base64 !== 'string' || !body.base64) throw new Error('archivo_vacio');
  if (body.base64.length * 0.75 > MAX_BYTES) throw new Error('archivo_muy_grande');

  var bytes = Utilities.base64Decode(body.base64);
  if (bytes.length > MAX_BYTES) throw new Error('archivo_muy_grande');
  if (!matchesMime_(bytes, mime)) throw new Error('contenido_no_coincide');

  var name = safeName_(prefix) + '-' + Date.now() + '-' + randomSuffix_() + '.' + EXTENSIONS[mime];
  var blob = Utilities.newBlob(bytes, mime, name);
  var file = DriveApp.getFolderById(folderId).createFile(blob);
  if (makePublic) {
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {
      // Drive niega cambiar el acceso de un archivo cuando la carpeta ya impone el suyo (por
      // ejemplo, "Cualquiera con el enlace: Editor"). El archivo hereda ese acceso, así que se
      // conserva si de verdad se puede ver sin iniciar sesión; si no, se descarta.
      console.error('setSharing: ' + err);
      if (!isPubliclyVisible_(file.getId())) {
        file.setTrashed(true);
        throw new Error('no_se_pudo_compartir');
      }
    }
  }
  return file.getId();
}

/** true si Drive sirve la miniatura del archivo sin sesión (es decir, es público de verdad). */
function isPubliclyVisible_(fileId) {
  try {
    var res = UrlFetchApp.fetch(
      'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w64',
      { muteHttpExceptions: true },
    );
    var type = String(res.getHeaders()['Content-Type'] || '');
    return res.getResponseCode() === 200 && type.indexOf('image/') === 0;
  } catch (err) {
    return false;
  }
}

function getFileInFolder_(fileId, folderId) {
  var file = loadFile_(fileId);
  if (!hasParent_(file, folderId)) throw new Error('archivo_no_permitido');
  return file;
}

function getFileInAnyFolder_(fileId) {
  var file = loadFile_(fileId);
  if (!hasParent_(file, prop_('PUBLIC_FOLDER_ID')) && !hasParent_(file, prop_('PRIVATE_FOLDER_ID'))) {
    throw new Error('archivo_no_permitido');
  }
  return file;
}

function loadFile_(fileId) {
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) {
    throw new Error('id_invalido');
  }
  try {
    return DriveApp.getFileById(fileId);
  } catch (e) {
    throw new Error('archivo_no_encontrado');
  }
}

function hasParent_(file, folderId) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

/** Comprueba la firma del archivo (JPEG, PNG o WebP); los bytes de Apps Script van con signo. */
function matchesMime_(bytes, mime) {
  var b = [];
  for (var i = 0; i < 12 && i < bytes.length; i++) b.push(bytes[i] & 0xff);
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === 'image/webp') {
    return (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
    );
  }
  return false;
}

// ---------- Autenticación ----------

/**
 * Verifica el ID token con Identity Toolkit. Devuelve { uid, isAnonymous, email, emailVerified }
 * o null. El resultado se recuerda 2 minutos (clave = hash del token) para no repetir la llamada
 * en ráfagas de peticiones (por ejemplo, varias imágenes seguidas).
 */
function verifyIdToken_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 4096) return null;

  var cache = CacheService.getScriptCache();
  var key = 'tok_' + digest_(idToken);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
      encodeURIComponent(prop_('FIREBASE_API_KEY')),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    },
  );
  if (res.getResponseCode() !== 200) return null;

  var users = JSON.parse(res.getContentText()).users;
  if (!users || !users.length) return null;
  var u = users[0];
  var user = {
    uid: u.localId,
    // Una sesión anónima no tiene proveedores vinculados.
    isAnonymous: !u.providerUserInfo || u.providerUserInfo.length === 0,
    email: String(u.email || '').toLowerCase(),
    emailVerified: u.emailVerified === true,
  };
  cache.put(key, JSON.stringify(user), TOKEN_CACHE_SEC);
  return user;
}

/**
 * true si es el admin fijo (ADMIN_EMAIL verificado) o si existe admins/{uid}. Lo segundo se lee
 * con el token del usuario (las reglas lo permiten) y se recuerda 2 minutos.
 */
function isAdmin_(user, idToken) {
  if (user.emailVerified && user.email === adminEmail_()) return true;

  var cache = CacheService.getScriptCache();
  var key = 'adm_' + user.uid;
  var hit = cache.get(key);
  if (hit !== null) return hit === '1';

  var res = UrlFetchApp.fetch(firestoreBase_() + '/admins/' + encodeURIComponent(user.uid), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true,
  });
  var admin = res.getResponseCode() === 200;
  cache.put(key, admin ? '1' : '0', ADMIN_CACHE_SEC);
  return admin;
}

// ---------- Firestore (REST, con el token del usuario) ----------

function firestoreBase_() {
  return (
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(prop_('FIREBASE_PROJECT_ID')) +
    '/databases/(default)/documents'
  );
}

/** Lee un documento como objeto plano, o null si no existe. Las reglas deciden si se puede leer. */
function getDoc_(path, idToken) {
  var res = UrlFetchApp.fetch(firestoreBase_() + '/' + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code === 404) return null;
  if (code === 403) throw new Error('no_autorizado');
  if (code !== 200) throw new Error('firestore_error');
  return fsFields_(JSON.parse(res.getContentText()).fields || {});
}

/** Lee varios documentos en una sola llamada. Devuelve solo los que existen. */
function batchGetDocs_(paths, idToken) {
  if (!paths.length) return [];
  var prefix = 'projects/' + prop_('FIREBASE_PROJECT_ID') + '/databases/(default)/documents/';
  var res = UrlFetchApp.fetch(firestoreBase_() + ':batchGet', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + idToken },
    payload: JSON.stringify({
      documents: paths.map(function (p) { return prefix + p; }),
    }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code === 403) throw new Error('no_autorizado');
  if (code !== 200) throw new Error('firestore_error');
  return JSON.parse(res.getContentText())
    .filter(function (r) { return r.found; })
    .map(function (r) {
      var doc = fsFields_(r.found.fields || {});
      doc.id = r.found.name.split('/').pop();
      return doc;
    });
}

function fsFields_(fields) {
  var out = {};
  for (var key in fields) out[key] = fsValue_(fields[key]);
  return out;
}

function fsValue_(v) {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue; // texto ISO 8601
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue_);
  if ('mapValue' in v) return fsFields_(v.mapValue.fields || {});
  return null;
}

// ---------- Utilidades ----------

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('cuerpo_vacio');
  if (e.postData.contents.length > MAX_BYTES * 1.5) throw new Error('archivo_muy_grande');
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('json_invalido');
  }
}

/** Propiedad del script, o su valor por defecto de DEFAULTS. */
function prop_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key) || DEFAULTS[key];
  if (!value) throw new Error('falta_configuracion');
  return value;
}

function adminEmail_() {
  return String(prop_('ADMIN_EMAIL')).toLowerCase();
}

function digest_(text) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text),
  );
}

function safeName_(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'archivo';
}

function randomSuffix_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// ======================================================================
// CORREOS
// ======================================================================

/**
 * Correos de SuChemaFC (se envían con MailApp desde la cuenta del dueño del script).
 *
 * Acciones (ver ACTIONS en Code.gs):
 *   notifyOrderCreated    Cliente (cualquier sesión): pedido recibido -> cliente + crsuchema@gmail.com.
 *   notifyPaymentApproved Admin: pago aprobado -> cliente.
 *   notifySupplierUpdate  Admin: novedad del pedido al proveedor -> cada cliente con camisas en él.
 *
 * El contenido sale SIEMPRE de Firestore (leído con el token de quien llama; las reglas limitan
 * qué puede leer cada uno), nunca de lo que mande el navegador. Cada aviso se registra en caché
 * para no repetirse si el navegador reintenta. Cuotas de Google: ~100 correos/día en cuentas
 * personales y ~1.500 en Google Workspace.
 */

var MAIL_DEDUP_SEC = 6 * 60 * 60 // no repetir el mismo aviso durante 6 horas
var MAX_SUPPLIER_RECIPIENTS = 150 // igual que MAX_ORDERS_PER_BATCH de la app
var TIME_ZONE = 'America/Costa_Rica'

var ORDER_STATUS_LABEL = {
  pago_pendiente_revision: 'Pago pendiente de revisión',
  adelanto_confirmado: 'Adelanto confirmado',
  pedido_al_proveedor: 'Pedido al proveedor',
  en_camino: 'En camino',
  listo_para_entrega: 'Listo para entrega',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  pago_rechazado: 'Pago rechazado',
}

var SUPPLIER_STATUS_LABEL = {
  pedido: 'Pedido realizado',
  en_produccion: 'En producción',
  enviado: 'Enviado',
  llego: 'Llegó',
}

// ---------- Acciones ----------

function notifyOrderCreated_(body, user) {
  var orderId = orderIdParam_(body.orderId)
  if (alreadySent_('created', orderId)) return { ok: true, sent: 0 }

  var order = getDoc_('orders/' + orderId, body.idToken)
  if (!order) throw new Error('pedido_no_encontrado')
  // Un cliente solo puede avisar de SU pedido (las reglas ya lo impiden, esto es doble seguro).
  if (order.uid !== user.uid && !isAdmin_(user, body.idToken)) throw new Error('no_autorizado')

  var sent = 0
  var customerEmail = customerEmail_(order)
  if (customerEmail) {
    sendMail_(
      customerEmail,
      'Recibimos tu pedido ' + orderRef_(orderId) + ' - SuChemaFC',
      mailLayout_(
        'Recibimos tu pedido',
        '<p>Hola ' +
          esc_(order.customer.name) +
          ', gracias por tu compra en SuChemaFC.</p>' +
          '<p>Tu pedido <b>' +
          orderRef_(orderId) +
          '</b> quedó <b>pendiente de revisión de pago</b>. ' +
          'Cuando aprobemos tu comprobante del adelanto te avisaremos por este mismo medio.</p>' +
          orderSummaryHtml_(order) +
          trackingHtml_(order),
      ),
    )
    sent++
  }

  sendMail_(
    adminEmail_(),
    'Nuevo pedido ' + orderRef_(orderId) + ' de ' + order.customer.name,
    mailLayout_(
      'Nuevo pedido recibido',
      '<p>Se realizó el pedido <b>' +
        orderRef_(orderId) +
        '</b>. Hay un comprobante por revisar.</p>' +
        '<p><b>Cliente:</b> ' +
        esc_(order.customer.name) +
        '<br>' +
        '<b>Teléfono:</b> ' +
        esc_(order.customer.phone) +
        '<br>' +
        '<b>Correo:</b> ' +
        esc_(customerEmail || 'no indicó') +
        '<br>' +
        '<b>Entrega:</b> ' +
        (order.shippingMethod === 'correos' ? 'Correos de Costa Rica' : 'Coordinada por WhatsApp') +
        '</p>' +
        orderSummaryHtml_(order) +
        '<p>Revísalo en <a href="' +
        siteUrl_() +
        '/admin/pedidos">Administración &gt; Pedidos</a>.</p>',
    ),
  )
  sent++

  markSent_('created', orderId)
  return { ok: true, sent: sent }
}

function notifyPaymentApproved_(body) {
  var orderId = orderIdParam_(body.orderId)
  var order = getDoc_('orders/' + orderId, body.idToken)
  if (!order) throw new Error('pedido_no_encontrado')

  var customerEmail = customerEmail_(order)
  if (!customerEmail) return { ok: true, sent: 0 }

  // Un pago por aviso: si el navegador reintenta, no se repite; un pago nuevo sí avisa.
  var paymentKey = orderId + '_' + (order.payments ? order.payments.length : 0)
  // `resend`: el admin pidió reenviar el correo (por ejemplo con el recibo), así que no se descarta.
  if (!body.resend && alreadySent_('paid', paymentKey)) return { ok: true, sent: 0 }

  var paid = Number(order.paidAmount) || 0
  var pending = Math.max(0, (Number(order.total) || 0) - paid)
  var receipt = receiptAttachment_(body.receiptImage, orderId)
  sendMail_(
    customerEmail,
    'Pago aprobado - pedido ' + orderRef_(orderId) + ' - SuChemaFC',
    mailLayout_(
      'Tu pago fue aprobado',
      '<p>Hola ' +
        esc_(order.customer.name) +
        ',</p>' +
        '<p>Aprobamos tu comprobante del adelanto del pedido <b>' +
        orderRef_(orderId) +
        '</b>. ' +
        'Ya reservamos tus camisas.</p>' +
        '<p><b>Total recibido:</b> ' +
        money_(paid) +
        '<br>' +
        (pending > 0
          ? '<b>Saldo pendiente:</b> ' + money_(pending) + ' (se paga antes de la entrega)'
          : 'Tu pedido está pagado por completo.') +
        '</p>' +
        (receipt.length
          ? '<p>Adjuntamos tu recibo con el código QR de tu pedido. Guárdalo: lo necesitarás al recibir tus camisas.</p>'
          : '') +
        trackingHtml_(order),
    ),
    receipt,
  )
  markSent_('paid', paymentKey)
  return { ok: true, sent: 1 }
}

function notifySupplierUpdate_(body) {
  var supplierId = orderIdParam_(body.supplierOrderId)
  var supplier = getDoc_('supplierOrders/' + supplierId, body.idToken)
  if (!supplier) throw new Error('pedido_no_encontrado')

  var ids = {}
  ;(supplier.lineRefs || []).forEach(function (r) {
    ids[r.orderId] = true
  })
  var orderIds = Object.keys(ids).slice(0, MAX_SUPPLIER_RECIPIENTS)

  var note = String(body.note || '').slice(0, 300)
  var statusText = SUPPLIER_STATUS_LABEL[supplier.status] || supplier.status
  var dateText = supplier.estimatedDate ? formatDate_(supplier.estimatedDate) : 'por confirmar'

  // Mismo aviso (mismo estado, fecha y nota) no se repite aunque el navegador reintente.
  var key = supplierId + '_' + digest_(supplier.status + '|' + dateText + '|' + note)
  if (alreadySent_('supplier', key)) return { ok: true, sent: 0 }

  // Una sola lectura (batchGet) para todos los pedidos de clientes.
  var orders = batchGetDocsWithIds_(orderIds, body.idToken)
  var sent = 0
  orders.forEach(function (order) {
    var email = customerEmail_(order)
    if (!email) return
    sendMail_(
      email,
      'Novedad de tu pedido ' + orderRef_(order.id) + ' - SuChemaFC',
      mailLayout_(
        'Novedad de tu pedido',
        '<p>Hola ' +
          esc_(order.customer.name) +
          ',</p>' +
          '<p>Tu pedido <b>' +
          orderRef_(order.id) +
          '</b> tiene una novedad con el proveedor:</p>' +
          '<p><b>Estado:</b> ' +
          esc_(statusText) +
          '<br>' +
          '<b>Fecha estimada de llegada:</b> ' +
          esc_(dateText) +
          ' <span style="color:#666">(puede cambiar si el proveedor se atrasa)</span>' +
          (note ? '<br><b>Mensaje:</b> ' + esc_(note) : '') +
          '</p>' +
          '<p><b>Estado de tu pedido:</b> ' +
          esc_(ORDER_STATUS_LABEL[order.status] || order.status) +
          '</p>' +
          trackingHtml_(order),
      ),
    )
    sent++
  })

  markSent_('supplier', key)
  return { ok: true, sent: sent }
}

// ---------- Piezas de correo ----------

function orderSummaryHtml_(order) {
  var rows = (order.lines || []).map(function (l) {
    var extras = (l.patches || []).map(function (p) {
      return p.name
    })
    if (l.custom)
      extras.push('personalizada ' + [l.custom.name, l.custom.number].filter(Boolean).join(' '))
    return (
      '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">' +
      esc_(l.qty + ' x ' + l.name + ' (talla ' + l.size + ')') +
      (extras.length
        ? '<br><span style="color:#666;font-size:12px">' + esc_(extras.join(', ')) + '</span>'
        : '') +
      '</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">' +
      money_((Number(l.unitPrice) || 0) * (Number(l.qty) || 0)) +
      '</td></tr>'
    )
  })
  return (
    '<table style="width:100%;border-collapse:collapse;margin:12px 0">' +
    rows.join('') +
    '</table>' +
    '<p><b>Total:</b> ' +
    money_(order.total) +
    '<br>' +
    '<b>Adelanto requerido:</b> ' +
    money_(order.advanceRequired) +
    '</p>'
  )
}

function trackingHtml_(order) {
  if (!order.trackingCode) return ''
  var url = siteUrl_() + '/?pedido=' + encodeURIComponent(order.trackingCode)
  return (
    '<p>Puedes ver el estado de tu pedido en cualquier momento aquí:<br>' +
    '<a href="' +
    url +
    '" style="color:#8a6d00;font-weight:bold">' +
    url +
    '</a></p>'
  )
}

function mailLayout_(title, content) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">' +
    '<div style="background:#000;color:#d4af37;padding:16px 20px;font-size:20px;font-weight:bold">SuChemaFC</div>' +
    '<div style="padding:20px;color:#222;font-size:14px;line-height:1.5">' +
    '<h2 style="margin:0 0 12px;font-size:18px">' +
    esc_(title) +
    '</h2>' +
    content +
    '</div>' +
    '<div style="background:#f5f5f5;color:#666;padding:12px 20px;font-size:12px">' +
    'Este es un aviso automático de SuChemaFC. Si tienes dudas, responde a este correo.' +
    '</div></div>'
  )
}

// ---------- Utilidades de correo ----------

function sendMail_(to, subject, html, attachments) {
  var options = {
    to: to,
    subject: subject,
    htmlBody: html,
    name: 'SuChemaFC',
    replyTo: adminEmail_(),
  }
  if (attachments && attachments.length) options.attachments = attachments
  MailApp.sendEmail(options)
}

/**
 * Recibo (imagen PNG) que manda el navegador en base64 como adjunto. Se acepta solo si de verdad es
 * un PNG pequeño; si no, el correo sale sin adjunto en vez de fallar.
 */
function receiptAttachment_(base64, orderId) {
  var text = String(base64 || '')
  if (!text || text.length > 600000) return []
  try {
    var bytes = Utilities.base64Decode(text)
    // Firma de un PNG: 89 50 4E 47 (los bytes de Apps Script van con signo).
    var isPng =
      bytes.length > 8 && bytes[0] === -119 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    if (!isPng) return []
    return [Utilities.newBlob(bytes, 'image/png', 'recibo-' + orderRef_(orderId) + '.png')]
  } catch (err) {
    return []
  }
}

/** Correo del cliente si es válido; '' si no lo indicó. */
function customerEmail_(order) {
  var email =
    order && order.customer && order.customer.email ? String(order.customer.email).trim() : ''
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length <= 200 ? email : ''
}

/** Lee varios pedidos de una vez ({ id, ...datos }). */
function batchGetDocsWithIds_(ids, idToken) {
  return batchGetDocs_(
    ids.map(function (id) {
      return 'orders/' + id
    }),
    idToken,
  )
}

function orderIdParam_(value) {
  var id = String(value || '')
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new Error('id_invalido')
  return id
}

function orderRef_(orderId) {
  return String(orderId).slice(0, 8).toUpperCase()
}

function alreadySent_(scope, key) {
  return CacheService.getScriptCache().get('mail_' + scope + '_' + key) !== null
}

function markSent_(scope, key) {
  CacheService.getScriptCache().put('mail_' + scope + '_' + key, '1', MAIL_DEDUP_SEC)
}

function siteUrl_() {
  return String(prop_('SITE_URL')).replace(/\/+$/, '')
}

function money_(amount) {
  var n = Math.round(Number(amount) || 0)
  return 'CRC ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatDate_(iso) {
  var d = new Date(iso)
  return isNaN(d.getTime()) ? String(iso) : Utilities.formatDate(d, TIME_ZONE, 'dd/MM/yyyy')
}

function esc_(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
