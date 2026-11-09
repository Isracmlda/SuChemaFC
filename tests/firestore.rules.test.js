import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { buildOrder, buildTrackingSummary } from '../src/features/checkout/checkout.js'

const GOOGLE = { firebase: { sign_in_provider: 'google.com' } }
const ANON = { firebase: { sign_in_provider: 'anonymous' } }
const CODE = 'a'.repeat(32) // rastreo del pedido semilla o1
const NEW_CODE = 'n'.repeat(32) // rastreo para pedidos nuevos

let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-suchemafc',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'admins/admin1'), { createdAt: 1 })
    await setDoc(doc(db, 'settings/payment'), { advancePercent: 50 })
    await setDoc(doc(db, 'products/visible1'), { name: 'A', visible: true, deleted: false })
    await setDoc(doc(db, 'products/hidden1'), { name: 'B', visible: false, deleted: false })
    await setDoc(doc(db, 'products/deleted1'), { name: 'C', visible: true, deleted: true })
    await setDoc(doc(db, 'productPrivate/visible1'), { cost: 1000, margin: 500 })
    await setDoc(doc(db, 'orders/o1'), {
      uid: 'alice',
      trackingCode: CODE,
      status: 'pago_pendiente_revision',
      createdAt: 1,
    })
    await setDoc(doc(db, `orderTracking/${CODE}`), {
      orderId: 'o1',
      status: 'pago_pendiente_revision',
      createdAt: 1,
    })
    await setDoc(doc(db, 'users/alice'), { email: 'alice@example.com' })
    await setDoc(doc(db, 'reviews/visible1_alice'), { uid: 'alice', approved: false })
    await setDoc(doc(db, 'reviews/visible1_bob'), { uid: 'bob', approved: true })
    await setDoc(doc(db, 'coupons/PROMO'), {
      active: true,
      type: 'percent',
      value: 10,
      maxUses: 1,
      usedCount: 0,
      startsAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 86400000),
    })
  })
})

const anon = (uid = 'guest1') => env.authenticatedContext(uid, ANON).firestore()
const google = (uid = 'alice', extra = {}) =>
  env
    .authenticatedContext(uid, { ...GOOGLE, email: `${uid}@example.com`, name: uid, ...extra })
    .firestore()
const admin = () => google('admin1')
const noAuth = () => env.unauthenticatedContext().firestore()

function orderData(uid, overrides = {}) {
  return {
    uid,
    trackingCode: NEW_CODE,
    customer: { name: 'Ana', phone: '88888888' },
    shippingMethod: 'whatsapp',
    lines: [{ productId: 'visible1', qty: 1 }],
    subtotal: 20000,
    discount: 0,
    shipping: 0,
    total: 20000,
    advanceRequired: 10000,
    status: 'pago_pendiente_revision',
    paidAmount: 0,
    payments: [],
    deleted: false,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

function trackingData(orderId, overrides = {}) {
  return {
    orderId,
    status: 'pago_pendiente_revision',
    timeline: [{ status: 'pago_pendiente_revision' }],
    summary: [{ name: 'Camiseta', size: 'M', qty: 1 }],
    estimatedDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

/** Crea pedido + rastreo en un solo lote, como hará el checkout. */
function placeOrder(db, orderId, order, tracking, extra) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'orders', orderId), order)
  batch.set(doc(db, 'orderTracking', order.trackingCode), tracking)
  extra?.(batch)
  return batch.commit()
}

describe('endurecimiento general', () => {
  it('una colección no declarada se deniega a todos, incluido el admin', async () => {
    await assertFails(getDoc(doc(admin(), 'secretos/x')))
    await assertFails(setDoc(doc(admin(), 'secretos/x'), { a: 1 }))
    await assertFails(getDoc(doc(noAuth(), 'secretos/x')))
  })

  it('nadie, salvo el admin, escribe en admins; un usuario no se hace admin', async () => {
    await assertFails(setDoc(doc(google('mallory'), 'admins/mallory'), { createdAt: 1 }))
    await assertFails(setDoc(doc(anon('mallory'), 'admins/mallory'), { createdAt: 1 }))
    await assertFails(getDoc(doc(google('mallory'), 'admins/admin1')))
  })
})

describe('catálogo público', () => {
  it('cualquiera lee secciones y ajustes, pero solo admin escribe', async () => {
    await assertSucceeds(getDoc(doc(noAuth(), 'sections/s1')))
    await assertSucceeds(getDoc(doc(noAuth(), 'settings/payment')))
    await assertFails(setDoc(doc(google('alice'), 'sections/s1'), { name: 'x' }))
    await assertFails(setDoc(doc(anon(), 'settings/payment'), { advancePercent: 1 }))
    await assertSucceeds(setDoc(doc(admin(), 'sections/s1'), { name: 'x' }))
  })

  it('el público solo lista productos visibles y no eliminados', async () => {
    const q = query(
      collection(noAuth(), 'products'),
      where('visible', '==', true),
      where('deleted', '==', false),
    )
    await assertSucceeds(getDocs(q))
    await assertFails(getDocs(collection(noAuth(), 'products')))
    await assertFails(getDoc(doc(noAuth(), 'products/hidden1')))
    await assertFails(getDoc(doc(noAuth(), 'products/deleted1')))
    await assertSucceeds(getDoc(doc(noAuth(), 'products/visible1')))
  })

  it('el admin lee todo y los clientes no escriben productos', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'products/hidden1')))
    await assertFails(
      setDoc(doc(google('alice'), 'products/p9'), { visible: true, deleted: false }),
    )
  })

  it('el costo del proveedor es solo admin', async () => {
    await assertFails(getDoc(doc(noAuth(), 'productPrivate/visible1')))
    await assertFails(getDoc(doc(google('alice'), 'productPrivate/visible1')))
    await assertSucceeds(getDoc(doc(admin(), 'productPrivate/visible1')))
  })
})

describe('roles', () => {
  it('un usuario solo lee su propio admins/{uid} y no puede autopromoverse', async () => {
    await assertSucceeds(getDoc(doc(google('alice'), 'admins/alice')))
    await assertFails(getDoc(doc(google('alice'), 'admins/admin1')))
    await assertFails(setDoc(doc(google('alice'), 'admins/alice'), { x: 1 }))
    await assertFails(setDoc(doc(anon('alice'), 'admins/alice'), { x: 1 }))
  })
  const SUPER = { email: 'crsuchema@gmail.com', email_verified: true }
  const superAdmin = () => google('super1', SUPER)

  it('admin fijo: crsuchema@gmail.com verificado es admin sin documento en admins', async () => {
    await assertSucceeds(setDoc(doc(superAdmin(), 'sections/s1'), { name: 'x' }))
    // Sin verificar el correo, o desde una sesión anónima, no vale.
    await assertFails(
      setDoc(doc(google('fake', { ...SUPER, email_verified: false }), 'sections/s1'), {
        name: 'x',
      }),
    )
    await assertFails(setDoc(doc(anon('fake'), 'sections/s1'), { name: 'x' }))
  })

  it('un admin da y quita el rol de admin; un usuario normal no', async () => {
    const grant = { email: 'alice@example.com', createdAt: serverTimestamp(), grantedBy: 'admin1' }
    await assertFails(setDoc(doc(google('alice'), 'admins/alice'), grant))
    await assertFails(setDoc(doc(google('alice'), 'admins/bob'), grant))
    await assertSucceeds(setDoc(doc(admin(), 'admins/alice'), grant))
    await assertFails(setDoc(doc(admin(), 'admins/alice'), { ...grant, extra: true }))
    await assertSucceeds(getDoc(doc(google('alice'), 'admins/alice')))
    await assertSucceeds(deleteDoc(doc(admin(), 'admins/alice')))
    await assertFails(deleteDoc(doc(google('bob'), 'admins/admin1')))
  })

  it('users: solo un admin elimina perfiles, nunca el propio ni el del admin fijo', async () => {
    const profile = (email) => ({
      displayName: 'X',
      email,
      photoURL: '',
      lastLoginAt: serverTimestamp(),
    })
    await assertSucceeds(setDoc(doc(google('bob'), 'users/bob'), profile('bob@example.com')))
    await assertSucceeds(setDoc(doc(superAdmin(), 'users/super1'), profile('crsuchema@gmail.com')))
    await assertFails(deleteDoc(doc(google('bob'), 'users/bob')))
    await assertFails(deleteDoc(doc(google('alice'), 'users/bob')))
    await assertFails(deleteDoc(doc(admin(), 'users/super1')))
    await assertSucceeds(deleteDoc(doc(admin(), 'users/bob')))
  })

  it('una sesión anónima nunca es admin, aunque su uid esté en admins', async () => {
    await assertFails(setDoc(doc(anon('admin1'), 'sections/s1'), { name: 'x' }))
    await assertFails(getDoc(doc(anon('admin1'), 'productPrivate/visible1')))
  })

  it('users: solo el dueño de Google lee y escribe su perfil con su correo real', async () => {
    const profile = {
      displayName: 'Alice',
      email: 'alice@example.com',
      photoURL: '',
      lastLoginAt: serverTimestamp(),
    }
    await assertSucceeds(setDoc(doc(google('alice'), 'users/alice'), profile))
    await assertFails(
      setDoc(doc(google('alice'), 'users/alice'), { ...profile, email: 'otro@x.com' }),
    )
    await assertFails(setDoc(doc(google('alice'), 'users/alice'), { ...profile, isAdmin: true }))
    await assertFails(setDoc(doc(google('bob'), 'users/alice'), profile))
    await assertFails(getDoc(doc(google('bob'), 'users/alice')))
    await assertFails(getDoc(doc(anon('zed'), 'users/alice')))
    await assertSucceeds(getDoc(doc(google('alice'), 'users/alice')))
    await assertSucceeds(getDoc(doc(admin(), 'users/alice')))
  })

  it('users: guarda carrito y deseos con updateDoc, con límites de tamaño', async () => {
    const profile = {
      displayName: 'Alice',
      email: 'alice@example.com',
      photoURL: '',
      lastLoginAt: serverTimestamp(),
    }
    const alice = google('alice')
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), profile))

    const line = (i) => ({
      key: `p${i}|M||`,
      productId: `p${i}`,
      size: 'M',
      patches: { g1: 0 },
      custom: null,
      qty: 1,
      priceAt: 25000,
    })
    const lines = (n) => Array.from({ length: n }, (_, i) => line(i))
    const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`)

    await assertSucceeds(
      updateDoc(doc(alice, 'users/alice'), { cart: lines(50), wishlist: ids(200) }),
    )
    await assertFails(updateDoc(doc(alice, 'users/alice'), { cart: lines(51), wishlist: [] }))
    await assertFails(updateDoc(doc(alice, 'users/alice'), { cart: [], wishlist: ids(201) }))
    await assertFails(updateDoc(doc(google('bob'), 'users/alice'), { cart: [], wishlist: [] }))
  })
})

describe('pedidos', () => {
  it('un invitado anónimo crea pedido + rastreo en un lote válido', async () => {
    await assertSucceeds(placeOrder(anon('guest1'), 'o2', orderData('guest1'), trackingData('o2')))
  })

  it('no se puede crear un pedido a nombre de otro uid', async () => {
    await assertFails(placeOrder(anon('guest1'), 'o2', orderData('alice'), trackingData('o2')))
  })

  it('exige adelanto mínimo del porcentaje configurado', async () => {
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { advanceRequired: 9999 }), trackingData('o2')),
    )
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { advanceRequired: 20001 }), trackingData('o2')),
    )
    await assertSucceeds(
      placeOrder(anon(), 'o2', orderData('guest1', { advanceRequired: 10000 }), trackingData('o2')),
    )
  })

  it('rechaza totales que no cuadran, descuentos sin cupón y valores negativos', async () => {
    const bad = [
      { total: 100, advanceRequired: 50 },
      { discount: 5000, total: 15000, advanceRequired: 7500 },
      { shipping: -1000, total: 19000, advanceRequired: 9500 },
      { subtotal: 0, total: 0, advanceRequired: 0 },
    ]
    for (const overrides of bad) {
      await assertFails(
        placeOrder(anon(), 'o2', orderData('guest1', overrides), trackingData('o2')),
      )
    }
  })

  it('rechaza estado inicial distinto, campos extra y código de rastreo corto', async () => {
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { status: 'entregado' }), trackingData('o2')),
    )
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { paidAmount: 20000 }), trackingData('o2')),
    )
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { isAdmin: true }), trackingData('o2')),
    )
    await assertFails(
      placeOrder(anon(), 'o2', orderData('guest1', { trackingCode: 'corto' }), trackingData('o2')),
    )
  })

  it('un pedido sin su rastreo en el mismo lote es rechazado', async () => {
    await assertFails(setDoc(doc(anon(), 'orders/o2'), orderData('guest1')))
  })

  it('solo el dueño y el admin leen un pedido', async () => {
    await assertSucceeds(getDoc(doc(anon('alice'), 'orders/o1')))
    await assertSucceeds(getDoc(doc(admin(), 'orders/o1')))
    await assertFails(getDoc(doc(anon('bob'), 'orders/o1')))
    await assertFails(getDoc(doc(noAuth(), 'orders/o1')))
    await assertFails(getDocs(collection(anon('bob'), 'orders')))
  })

  it('el dueño filtra sus pedidos por uid; sin filtro falla', async () => {
    await assertSucceeds(
      getDocs(query(collection(anon('alice'), 'orders'), where('uid', '==', 'alice'))),
    )
    await assertFails(getDocs(collection(anon('alice'), 'orders')))
  })

  it('el cliente no puede cambiar estado ni pagos; el admin sí', async () => {
    await assertFails(updateDoc(doc(anon('alice'), 'orders/o1'), { status: 'adelanto_confirmado' }))
    await assertFails(updateDoc(doc(anon('alice'), 'orders/o1'), { paidAmount: 99999 }))
    await assertSucceeds(updateDoc(doc(admin(), 'orders/o1'), { status: 'adelanto_confirmado' }))
    await assertFails(updateDoc(doc(admin(), 'orders/o1'), { status: 'inventado' }))
    await assertFails(updateDoc(doc(admin(), 'orders/o1'), { uid: 'otro' }))
  })

  it('solo el admin borra pedidos', async () => {
    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(anon('alice'), 'orders/o1')))
    await assertSucceeds(deleteDoc(doc(admin(), 'orders/o1')))
  })

  it('las notas internas son solo del admin', async () => {
    await assertFails(setDoc(doc(anon('alice'), 'orderPrivate/o1'), { note: 'x' }))
    await assertFails(getDoc(doc(anon('alice'), 'orderPrivate/o1')))
    await assertSucceeds(setDoc(doc(admin(), 'orderPrivate/o1'), { note: 'x' }))
  })
})

describe('rastreo público', () => {
  it('get por código funciona sin sesión, pero no hay listado', async () => {
    await assertSucceeds(getDoc(doc(noAuth(), `orderTracking/${CODE}`)))
    await assertFails(getDocs(collection(noAuth(), 'orderTracking')))
    await assertFails(getDocs(collection(anon(), 'orderTracking')))
    await assertSucceeds(getDocs(collection(admin(), 'orderTracking')))
  })

  it('solo el admin actualiza el rastreo', async () => {
    await assertFails(
      updateDoc(doc(anon('alice'), `orderTracking/${CODE}`), { status: 'entregado' }),
    )
    await assertFails(updateDoc(doc(noAuth(), `orderTracking/${CODE}`), { status: 'entregado' }))
    await assertSucceeds(updateDoc(doc(admin(), `orderTracking/${CODE}`), { status: 'en_camino' }))
  })

  it('no se puede crear un rastreo suelto ni apuntando a un pedido ajeno', async () => {
    await assertFails(
      setDoc(doc(anon('bob'), `orderTracking/${'b'.repeat(32)}`), trackingData('o1')),
    )
    await assertFails(
      setDoc(doc(anon('bob'), `orderTracking/${'b'.repeat(32)}`), trackingData('nuevo')),
    )
  })
})

describe('cupones', () => {
  it('no se listan; se leen por código con sesión', async () => {
    await assertFails(getDocs(collection(anon(), 'coupons')))
    await assertFails(getDoc(doc(noAuth(), 'coupons/PROMO')))
    await assertSucceeds(getDoc(doc(anon(), 'coupons/PROMO')))
    await assertSucceeds(getDocs(collection(admin(), 'coupons')))
  })

  it('un cliente no edita un cupón por su cuenta', async () => {
    await assertFails(updateDoc(doc(anon(), 'coupons/PROMO'), { value: 100 }))
    await assertFails(updateDoc(doc(anon(), 'coupons/PROMO'), { usedCount: 1 }))
  })

  it('un pedido con cupón registra el uso en el mismo lote y se descuenta bien', async () => {
    const db = anon('guest1')
    const order = orderData('guest1', {
      couponCode: 'PROMO',
      discount: 2000,
      total: 18000,
      advanceRequired: 9000,
    })
    await assertSucceeds(
      placeOrder(db, 'o2', order, trackingData('o2'), (batch) =>
        batch.update(doc(db, 'coupons/PROMO'), { usedCount: 1, lastOrderId: 'o2' }),
      ),
    )
  })

  it('un pedido con cupón sin registrar el uso es rechazado', async () => {
    const order = orderData('guest1', {
      couponCode: 'PROMO',
      discount: 2000,
      total: 18000,
      advanceRequired: 9000,
    })
    await assertFails(placeOrder(anon('guest1'), 'o2', order, trackingData('o2')))
  })
  it('el admin crea y edita cupones (con alcance) sin tocar el contador; un cliente no crea', async () => {
    const coupon = {
      type: 'fixed',
      value: 3000,
      scope: { type: 'sections', ids: ['s1'] },
      minSubtotal: 0,
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 86400000),
      active: true,
      maxUses: 0,
      usedCount: 0,
      lastOrderId: '',
    }
    await assertSucceeds(setDoc(doc(admin(), 'coupons/VERANO'), coupon))
    await assertSucceeds(updateDoc(doc(admin(), 'coupons/VERANO'), { active: false }))
    await assertFails(setDoc(doc(google('alice'), 'coupons/OTRO'), coupon))
    await assertFails(updateDoc(doc(google('alice'), 'coupons/VERANO'), { active: true }))
  })

  it('un cupón desactivado o vencido no admite registrar un uso', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'coupons/PROMO'), { active: false }),
    )
    const db = anon('guest1')
    const order = orderData('guest1', {
      couponCode: 'PROMO',
      discount: 2000,
      total: 18000,
      advanceRequired: 9000,
    })
    await assertFails(
      placeOrder(db, 'o2', order, trackingData('o2'), (batch) =>
        batch.update(doc(db, 'coupons/PROMO'), { usedCount: 1, lastOrderId: 'o2' }),
      ),
    )
  })

  it('el admin aplica una oferta con fechas y cuenta regresiva a una camisa', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'products/visible1'), {
        sale: {
          price: 18000,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86400000),
          countdown: true,
        },
      }),
    )
    await assertFails(
      updateDoc(doc(google('alice'), 'products/visible1'), {
        sale: { price: 1, countdown: false },
      }),
    )
  })

  it('no se puede superar el máximo de usos ni sumar más de 1', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'coupons/PROMO'), { usedCount: 1 }),
    )
    const db = anon('guest1')
    const order = orderData('guest1', {
      couponCode: 'PROMO',
      discount: 2000,
      total: 18000,
      advanceRequired: 9000,
    })
    await assertFails(
      placeOrder(db, 'o2', order, trackingData('o2'), (batch) =>
        batch.update(doc(db, 'coupons/PROMO'), { usedCount: 2, lastOrderId: 'o2' }),
      ),
    )
  })
})

describe('reseñas', () => {
  const review = (uid, overrides = {}) => ({
    productId: 'visible1',
    uid,
    authorName: uid,
    rating: 5,
    text: 'Excelente',
    photos: [],
    approved: false,
    createdAt: serverTimestamp(),
    ...overrides,
  })

  it('solo se leen las aprobadas, más las propias y todas para el admin', async () => {
    await assertSucceeds(getDoc(doc(noAuth(), 'reviews/visible1_bob')))
    await assertFails(getDoc(doc(noAuth(), 'reviews/visible1_alice')))
    await assertSucceeds(getDoc(doc(google('alice'), 'reviews/visible1_alice')))
    await assertSucceeds(getDoc(doc(admin(), 'reviews/visible1_alice')))
    await assertSucceeds(
      getDocs(query(collection(noAuth(), 'reviews'), where('approved', '==', true))),
    )
    await assertFails(getDocs(collection(noAuth(), 'reviews')))
  })

  it('crea una reseña propia pendiente; no aprobada ni a nombre de otro', async () => {
    await assertSucceeds(setDoc(doc(google('carol'), 'reviews/visible1_carol'), review('carol')))
    await assertFails(
      setDoc(doc(google('carol'), 'reviews/visible1_carol'), review('carol', { approved: true })),
    )
    await assertFails(setDoc(doc(google('carol'), 'reviews/visible1_bob'), review('bob')))
    await assertFails(
      setDoc(doc(google('carol'), 'reviews/visible1_carol'), review('carol', { rating: 9 })),
    )
    await assertFails(
      setDoc(
        doc(google('carol'), 'reviews/visible1_carol'),
        review('carol', { text: 'x'.repeat(1001) }),
      ),
    )
    await assertFails(setDoc(doc(anon('carol'), 'reviews/visible1_carol'), review('carol')))
  })

  it('las fotos son hasta 4 IDs de texto cortos; no listas gigantes ni otros tipos', async () => {
    // Un usuario distinto por caso: tras crear una reseña, el mismo ID ya sería un "update".
    const create = (uid, photos) =>
      setDoc(doc(google(uid), `reviews/visible1_${uid}`), review(uid, { photos }))
    await assertFails(create('u1', ['a', 'b', 'c', 'd', 'e']))
    await assertFails(create('u2', ['x'.repeat(101)]))
    await assertFails(create('u3', [123]))
    await assertFails(create('u4', ['']))
    await assertFails(create('u5', 'no-es-lista'))
    await assertSucceeds(create('u6', ['abc', 'def', 'ghi', 'jkl']))
  })

  it('el cliente no se autoaprueba; el admin solo cambia approved', async () => {
    await assertFails(updateDoc(doc(google('alice'), 'reviews/visible1_alice'), { approved: true }))
    await assertSucceeds(updateDoc(doc(admin(), 'reviews/visible1_alice'), { approved: true }))
    await assertFails(updateDoc(doc(admin(), 'reviews/visible1_alice'), { text: 'editado' }))
  })

  it('el dueño consulta su reseña aunque no exista; otro usuario o un invitado no', async () => {
    await assertSucceeds(getDoc(doc(google('carol'), 'reviews/visible1_carol')))
    await assertFails(getDoc(doc(google('carol'), 'reviews/visible1_dave')))
    await assertFails(getDoc(doc(anon('carol'), 'reviews/visible1_carol')))
    await assertFails(getDoc(doc(noAuth(), 'reviews/visible1_carol')))
  })

  it('las consultas de la app: aprobadas por camisa (público) y pendientes (admin)', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(noAuth(), 'reviews'),
          where('productId', '==', 'visible1'),
          where('approved', '==', true),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(query(collection(admin(), 'reviews'), where('approved', '==', false))),
    )
    await assertFails(
      getDocs(query(collection(google('carol'), 'reviews'), where('approved', '==', false))),
    )
  })
})

describe('checkout tal como lo arma placeOrder (subtarea 9)', () => {
  const lines = [
    {
      productId: 'visible1',
      name: 'Camiseta A',
      size: 'M',
      patches: [{ group: 'Liga', name: 'Parche', price: 2000 }],
      custom: { name: 'ANA', number: '10' },
      qty: 2,
      unitPrice: 20000,
    },
  ]
  const form = {
    name: 'Ana Mora',
    phone: '8888-8888',
    email: 'ana@example.com',
    province: 'San José',
    canton: 'Escazú',
    district: 'San Rafael',
    details: 'Casa blanca frente al parque',
    note: 'Llamar antes',
  }
  // Mismo armado que src/services/orders.js
  function checkoutBatch(db, orderId, overrides = {}, withCoupon = true) {
    const order = {
      ...buildOrder({
        uid: 'guest1',
        trackingCode: NEW_CODE,
        form,
        method: 'correos',
        lines,
        subtotal: 40000,
        discount: withCoupon ? 4000 : 0,
        couponCode: withCoupon ? 'PROMO' : undefined,
        shipping: 2500,
        advanceRequired: 19250,
        receiptFileId: 'drive-file-1',
      }),
      createdAt: serverTimestamp(),
      ...overrides,
    }
    const batch = writeBatch(db)
    batch.set(doc(db, 'orders', orderId), order)
    batch.set(doc(db, 'orderTracking', NEW_CODE), {
      orderId,
      status: order.status,
      timeline: [{ status: order.status, at: Timestamp.now(), note: '' }],
      summary: buildTrackingSummary(lines),
      estimatedDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    if (order.couponCode) {
      batch.update(doc(db, 'coupons', order.couponCode), {
        usedCount: increment(1),
        lastOrderId: orderId,
      })
    }
    return batch.commit()
  }

  it('acepta el lote completo con Correos, cupón, comprobante y rastreo', async () => {
    await assertSucceeds(checkoutBatch(anon('guest1'), 'o9'))
  })

  it('acepta el lote sin cupón y con retiro por WhatsApp', async () => {
    await assertSucceeds(
      checkoutBatch(
        anon('guest1'),
        'o9',
        { shippingMethod: 'whatsapp', shipping: 0, total: 40000, advanceRequired: 20000 },
        false,
      ),
    )
  })

  it('rechaza un adelanto menor al 50% del total', async () => {
    await assertFails(checkoutBatch(anon('guest1'), 'o9', { advanceRequired: 19000 }))
  })

  it('settings, paymentMethods: lectura pública, escritura solo del admin', async () => {
    for (const path of ['settings/payment', 'settings/shipping', 'settings/general']) {
      await assertSucceeds(getDoc(doc(noAuth(), path)))
      await assertFails(setDoc(doc(google('alice'), path), { advancePercent: 1 }))
      await assertSucceeds(setDoc(doc(admin(), path), { advancePercent: 50 }, { merge: true }))
    }
    const method = { type: 'sinpe', number: '88888888', holder: 'SuChema', visible: true }
    await assertFails(setDoc(doc(anon(), 'paymentMethods/m1'), method))
    await assertSucceeds(setDoc(doc(admin(), 'paymentMethods/m1'), method))
    await assertSucceeds(getDoc(doc(noAuth(), 'paymentMethods/m1')))
  })
})

describe('revisión de pagos (subtarea 10)', () => {
  const seedOrder = (id, code) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, 'orders', id), {
        uid: 'guest1',
        trackingCode: code,
        status: 'pago_pendiente_revision',
        total: 40000,
        advanceRequired: 20000,
        paidAmount: 0,
        payments: [],
        deleted: false,
        createdAt: 1,
      })
      await setDoc(doc(d, 'orderTracking', code), {
        orderId: id,
        status: 'pago_pendiente_revision',
        timeline: [],
        createdAt: 1,
      })
    })

  // Mismo lote que arma confirmPayment en src/services/adminOrders.js
  function confirmBatch(db, id, code, ref) {
    const batch = writeBatch(db)
    batch.set(doc(db, 'paymentRefs', ref), {
      orderId: id,
      amount: 20000,
      createdAt: serverTimestamp(),
    })
    batch.update(doc(db, 'orders', id), {
      payments: [{ amount: 20000, ref, at: Date.now() }],
      paidAmount: 20000,
      status: 'adelanto_confirmado',
    })
    batch.update(doc(db, 'orderTracking', code), {
      status: 'adelanto_confirmado',
      timeline: arrayUnion({ status: 'adelanto_confirmado', at: Timestamp.now(), note: '' }),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid: 'admin1',
      action: 'editar',
      createdAt: serverTimestamp(),
    })
    return batch.commit()
  }

  it('el admin confirma un pago en un lote; un cliente no', async () => {
    await seedOrder('o5', 'e'.repeat(32))
    await assertFails(confirmBatch(google('alice'), 'o5', 'e'.repeat(32), 'REF0001'))
    await assertSucceeds(confirmBatch(admin(), 'o5', 'e'.repeat(32), 'REF0001'))
  })

  it('un numero de comprobante no se puede registrar dos veces', async () => {
    await seedOrder('o5', 'e'.repeat(32))
    await seedOrder('o6', 'f'.repeat(32))
    await assertSucceeds(confirmBatch(admin(), 'o5', 'e'.repeat(32), 'REF0001'))
    await assertFails(confirmBatch(admin(), 'o6', 'f'.repeat(32), 'REF0001'))
    await assertFails(updateDoc(doc(admin(), 'paymentRefs/REF0001'), { orderId: 'o6' }))
  })

  it('el admin cancela con borrado logico y puede eliminar el pedido; un cliente no', async () => {
    await seedOrder('o5', 'e'.repeat(32))
    await assertSucceeds(
      updateDoc(doc(admin(), 'orders/o5'), { status: 'cancelado', deleted: true }),
    )
    await assertFails(deleteDoc(doc(google('alice'), 'orders/o5')))
    await assertSucceeds(deleteDoc(doc(admin(), 'orders/o5')))
  })

  it('las notas internas son del admin y se guardan con merge', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'orderPrivate/o5'), { notes: 'x' }, { merge: true }))
    await assertFails(getDoc(doc(anon('guest1'), 'orderPrivate/o5')))
  })

  // Mismo lote que arma createSupplierOrder / updateSupplierOrder en src/services/supplierOrders.js
  function supplierBatch(db, code, { create }) {
    const batch = writeBatch(db)
    if (create) {
      batch.set(doc(db, 'supplierOrders', 's1'), {
        supplier: 'Kitmm',
        status: 'pedido',
        lineRefs: [{ orderId: 'o5', lineIndex: 0 }],
        estimatedDate: Timestamp.fromMillis(Date.now() + 86400000),
        createdAt: serverTimestamp(),
      })
    } else {
      batch.update(doc(db, 'supplierOrders', 's1'), {
        status: 'enviado',
        updates: arrayUnion({ status: 'enviado', at: Timestamp.now(), note: '' }),
      })
    }
    batch.update(doc(db, 'orders', 'o5'), { status: 'pedido_al_proveedor' })
    batch.update(doc(db, 'orderTracking', code), {
      status: 'pedido_al_proveedor',
      estimatedDate: Timestamp.fromMillis(Date.now() + 86400000),
      timeline: arrayUnion({ status: 'pedido_al_proveedor', at: Timestamp.now(), note: '' }),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid: 'admin1',
      action: 'editar',
      createdAt: serverTimestamp(),
    })
    return batch.commit()
  }

  it('el admin crea y actualiza un pedido a proveedor con el rastreo del cliente; un cliente no', async () => {
    const code = 'e'.repeat(32)
    await seedOrder('o5', code)
    await assertFails(supplierBatch(google('alice'), code, { create: true }))
    await assertSucceeds(supplierBatch(admin(), code, { create: true }))
    await assertSucceeds(supplierBatch(admin(), code, { create: false }))
    await assertFails(getDoc(doc(anon('guest1'), 'supplierOrders/s1')))
  })

  // Mismo lote que arma deliverOrder en src/services/delivery.js (cobro con SINPE)
  function deliverBatch(db, code, ref) {
    const batch = writeBatch(db)
    if (ref) {
      batch.set(doc(db, 'paymentRefs', ref), {
        orderId: 'o5',
        amount: 20000,
        createdAt: serverTimestamp(),
      })
    }
    batch.update(doc(db, 'orders', 'o5'), {
      payments: [
        { amount: 20000, ref: ref ?? 'EFECTIVO', method: ref ? 'sinpe' : 'efectivo', at: 1 },
      ],
      paidAmount: 40000,
      status: 'entregado',
    })
    batch.update(doc(db, 'orderTracking', code), {
      status: 'entregado',
      timeline: arrayUnion({ status: 'entregado', at: Timestamp.now(), note: 'Entregado.' }),
      estimatedDate: null,
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid: 'admin1',
      action: 'editar',
      createdAt: serverTimestamp(),
    })
    return batch.commit()
  }

  it('el admin entrega un pedido cobrando el saldo (efectivo o SINPE); un cliente no', async () => {
    const code = 'e'.repeat(32)
    await seedOrder('o5', code)
    await assertFails(deliverBatch(google('alice'), code, 'REF7777'))
    await assertSucceeds(deliverBatch(admin(), code, null))
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'paymentRefs/REF7777'), { orderId: 'otro', amount: 1 }),
    )
    // Un comprobante SINPE ya usado no se puede volver a registrar al entregar.
    await assertFails(deliverBatch(admin(), code, 'REF7777'))
  })
})

describe('bitácora y comprobantes', () => {
  it('auditLog: el admin solo crea (con su uid); nadie edita ni borra', async () => {
    const entry = { actorUid: 'admin1', action: 'create', createdAt: serverTimestamp() }
    await assertSucceeds(setDoc(doc(admin(), 'auditLog/a1'), entry))
    await assertFails(setDoc(doc(admin(), 'auditLog/a2'), { ...entry, actorUid: 'otro' }))
    await assertFails(updateDoc(doc(admin(), 'auditLog/a1'), { action: 'x' }))
    await assertFails(setDoc(doc(google('alice'), 'auditLog/a3'), { ...entry, actorUid: 'alice' }))
    await assertFails(getDoc(doc(google('alice'), 'auditLog/a1')))
  })

  it('las consultas del dashboard y de la bitácora: solo el admin', async () => {
    const since = Timestamp.fromMillis(0)
    const dash = (db) =>
      getDocs(
        query(
          collection(db, 'orders'),
          where('createdAt', '>=', since),
          orderBy('createdAt', 'desc'),
          limit(500),
        ),
      )
    const audit = (db) =>
      getDocs(
        query(
          collection(db, 'auditLog'),
          where('createdAt', '<', Timestamp.now()),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      )
    await assertSucceeds(dash(admin()))
    await assertFails(dash(google('alice')))
    await assertSucceeds(audit(admin()))
    await assertFails(audit(google('alice')))
    await assertSucceeds(getDocs(collection(admin(), 'productPrivate')))
    await assertFails(getDocs(collection(google('alice'), 'productPrivate')))
  })

  it('paymentRefs y supplierOrders son solo del admin', async () => {
    await assertFails(setDoc(doc(google('alice'), 'paymentRefs/123'), { orderId: 'o1' }))
    await assertFails(getDoc(doc(anon(), 'supplierOrders/s1')))
    await assertSucceeds(setDoc(doc(admin(), 'paymentRefs/123'), { orderId: 'o1' }))
    await assertSucceeds(setDoc(doc(admin(), 'supplierOrders/s1'), { supplier: 'x' }))
  })

  it('cualquier ruta no definida está denegada', async () => {
    await assertFails(setDoc(doc(admin(), 'otraColeccion/x'), { a: 1 }))
    await assertFails(getDoc(doc(admin(), 'otraColeccion/x')))
  })
})

describe('mantenimiento del catálogo (lote de la subtarea 4)', () => {
  // Reproduce lo que hace saveProduct/commitWithAudit: producto + costo privado + bitácora.
  function catalogBatch(db, uid) {
    const batch = writeBatch(db)
    batch.set(doc(db, 'products/nueva1'), {
      name: 'Camiseta',
      price: 25000,
      visible: true,
      deleted: false,
      sale: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(db, 'productPrivate/nueva1'), { cost: 15000, margin: 10000 })
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid: uid,
      action: 'crear',
      collection: 'products',
      docId: 'nueva1',
      summary: 'Camisa "Camiseta"',
      createdAt: serverTimestamp(),
    })
    return batch.commit()
  }

  it('el admin guarda producto, costo privado y bitácora en un lote', async () => {
    await assertSucceeds(catalogBatch(admin(), 'admin1'))
  })

  it('un cliente con Google no puede guardar el mismo lote', async () => {
    await assertFails(catalogBatch(google('alice'), 'alice'))
  })

  it('el admin puede ocultar y eliminar (soft delete) en lote', async () => {
    const db = admin()
    const batch = writeBatch(db)
    batch.update(doc(db, 'products/visible1'), { visible: false, deleted: true })
    batch.update(doc(db, 'products/hidden1'), { deleted: true })
    await assertSucceeds(batch.commit())
  })

  it('el admin crea secciones, hashtags y grupos de parches', async () => {
    const db = admin()
    await assertSucceeds(
      setDoc(doc(db, 'sections/s1'), {
        name: 'Selecciones',
        parentId: null,
        order: 0,
        visible: true,
      }),
    )
    await assertSucceeds(setDoc(doc(db, 'tags/laliga'), { name: 'laliga', aliases: ['la liga'] }))
    await assertSucceeds(setDoc(doc(db, 'patchGroups/p1'), { name: 'Liga', order: 0, options: [] }))
  })

  it('el admin guarda tablas de tallas; un cliente no, pero sí puede leerlas', async () => {
    const data = {
      name: 'Hombre',
      note: '',
      order: 0,
      measures: ['Largo'],
      rows: [{ size: 'S', values: [70] }],
    }
    await assertSucceeds(setDoc(doc(admin(), 'sizeCharts/hombre'), data))
    await assertFails(setDoc(doc(google('alice'), 'sizeCharts/hombre'), data))
    await assertSucceeds(getDoc(doc(google('alice'), 'sizeCharts/hombre')))
  })

  it('competiciones y recargos estándar: el admin escribe, todos leen, un cliente no escribe', async () => {
    const competition = { name: 'Champions League', order: 0 }
    await assertSucceeds(setDoc(doc(admin(), 'competitions/c1'), competition))
    await assertFails(setDoc(doc(google('alice'), 'competitions/c2'), competition))
    await assertSucceeds(getDoc(doc(google('alice'), 'competitions/c1')))

    const surcharges = { values: { '3XL': 3000 } }
    await assertSucceeds(setDoc(doc(admin(), 'settings/sizeSurcharges'), surcharges))
    await assertFails(setDoc(doc(google('alice'), 'settings/sizeSurcharges'), surcharges))
    await assertSucceeds(getDoc(doc(google('alice'), 'settings/sizeSurcharges')))
  })
})
