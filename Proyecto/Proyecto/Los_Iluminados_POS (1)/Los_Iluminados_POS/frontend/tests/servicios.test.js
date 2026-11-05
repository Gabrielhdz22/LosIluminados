// Pruebas de los servicios. Ejecutar con:  node tests/servicios.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'js');
const files = ['data.js', ...['storage', 'registro', 'auth', 'catalogo', 'inventario', 'carrito', 'metodosPago', 'pedidos', 'pagos'].map(n => 'services/' + n + '.js')];

let ls = {};
const ctx = {
  console, process, setTimeout, TextEncoder, btoa, unescape, crypto: require('crypto').webcrypto,
  localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } }
};
ctx.window = ctx;
vm.createContext(ctx);

async function suite(assert, resetStorage, rawStorage, nodeSha) {
  let pass = 0;
  const test = async (name, fn) => {
    resetStorage(); _memClear();
    try { await fn(); pass++; console.log('  ✓', name); }
    catch (e) { console.log('  ✗', name, '\n     ', e.message); process.exitCode = 1; }
  };
  const _memClear = () => { for (const k of Object.keys(_mem)) delete _mem[k]; };
  const rejects = (p, re) => assert.rejects(p, re);
  const admin = async () => authService.login('ADMIN', '123456789');
  const cliente = async () => { await admin(); await registroService.register({ nombre: 'Beto', email: 'beto@x.com', password: 'secreto2' }); authService.logout(); return authService.login('beto@x.com', 'secreto2'); };
  const visa = { titular: 'Ana', numero: '4242 4242 4242 4242', vence: '12/40' };
  const declinada = { titular: 'Ana', numero: '4000 0000 0000 0002', vence: '12/40' };

  console.log('Registro y autenticación');
  await test('SHA-256 propio coincide con el nativo', async () => {
    for (const t of ['', 'abc', 'contraseña-ñ-€', 'x'.repeat(200)]) assert.strictEqual(sha256js(t), await nodeSha(t));
  });
  await test('la cuenta ADMIN preestablecida es admin y todos los registros son clientes', async () => {
    assert.strictEqual((await admin()).rol, 'admin');
    const u = await registroService.register({ nombre: 'Beto', email: 'beto@x.com', password: 'secreto2' });
    assert.strictEqual(u.rol, 'cliente');
    await rejects(authService.login('ADMIN', 'incorrecta'), /incorrectos/);
    await rejects(registroService.register({ nombre: 'Otra', email: 'admin@losiluminados.local', password: 'secreto3' }), /reservado/);
    assert.strictEqual((await authService.login('admin', '123456789')).rol, 'admin');
  });
  await test('valida datos y correo duplicado', async () => {
    await rejects(registroService.register({ nombre: 'A', email: 'a@x.com', password: '123456' }), /nombre/);
    await rejects(registroService.register({ nombre: 'Ana', email: 'malo', password: '123456' }), /correo/);
    await rejects(registroService.register({ nombre: 'Ana', email: 'a@x.com', password: '123' }), /6 caracteres/);
    await admin();
    await registroService.register({ nombre: 'Ana', email: 'ana@x.com', password: 'secreto1' });
    await rejects(registroService.register({ nombre: 'Otra', email: 'ANA@x.com', password: '123456' }), /ya está registrado/);
  });
  await test('las cuentas de encargado antiguas se convierten en clientes', async () => {
    const salt = 'legacy-salt';
    const oldAdmin = { id: 'legacy', nombre: 'Anterior', email: 'anterior@x.com', rol: 'admin', salt, hash: await sha256(salt + 'secreto1') };
    const reservedAdmin = { id: 'reserved', nombre: 'Otro', email: 'admin@losiluminados.local', rol: 'admin', salt, hash: await sha256(salt + 'vieja-clave') };
    store.set('users', [oldAdmin, reservedAdmin]);
    await authService.initialize();
    assert.strictEqual((await authService.login('anterior@x.com', 'secreto1')).rol, 'cliente');
    assert.strictEqual((await authService.login('ADMIN', '123456789')).rol, 'admin');
    await rejects(authService.login('ADMIN', 'vieja-clave'), /incorrectos/);
  });
  await test('login correcto, incorrecto y logout', async () => {
    await registroService.register({ nombre: 'Ana', email: 'ana@x.com', password: 'secreto1' });
    await authService.login('ana@x.com', 'secreto1'); authService.logout();
    assert.strictEqual(authService.current(), null);
    await rejects(authService.login('ana@x.com', 'mala'), /incorrectos/);
    await authService.login(' ANA@x.com ', 'secreto1');
    assert.strictEqual(authService.current().nombre, 'Ana');
  });
  await test('la sesión vencida se descarta', async () => {
    await admin();
    const s = JSON.parse(rawStorage('iluminados:session')); s.exp = Date.now() - 1;
    rawStorage('iluminados:session', JSON.stringify(s));
    assert.strictEqual(authService.current(), null);
  });

  console.log('Catálogo, carrito e inventario');
  await test('solo admin crea, edita y desactiva productos; productos nuevos inician sin stock', async () => {
    const input = { name: 'Figura de prueba', price: 55.5, categoria: 'Coleccionables', franquicia: 'Pruebas', sku: 'TEST-001', description: 'Producto temporal', image: '' };
    await rejects(catalogService.create(input), /Inicia sesión/);
    await cliente();
    await rejects(catalogService.create(input), /administrador/);
    authService.logout();
    await admin();
    const created = await catalogService.create(input);
    assert.strictEqual((await inventoryService.all())[created.id], 0);
    await rejects(catalogService.create({ ...input, sku: 're4-lsk-01' }), /SKU ya está/);
    await catalogService.update(created.id, { ...input, name: 'Figura editada', price: 60 });
    assert.strictEqual((await catalogService.get(created.id)).name, 'Figura editada');
    await catalogService.setActive(created.id, false);
    assert.strictEqual((await catalogService.get(created.id)).activo, false);
    assert.ok(!(await catalogService.list()).some(p => p.id === created.id));
    assert.ok((await catalogService.list({ includeInactive: true })).some(p => p.id === created.id));
    await rejects(cartService.add(created.id), /ya no está disponible/);
    await rejects(ordersService.create([{ id: created.id, quantity: 1 }]), /ya no está disponible/);
    await catalogService.setActive(created.id, true);
    await inventoryService.setQuantity(created.id, 4);
    assert.strictEqual((await inventoryService.all())[created.id], 4);
    await rejects(inventoryService.setQuantity(created.id, -1), /entero/);
  });
  await test('los reportes solo incluyen ventas pagadas y solo los consulta el admin', async () => {
    await cliente();
    await rejects(ordersService.salesSummary(), /administrador/);
    authService.logout();
    await admin();
    const order = await ordersService.create([{ id: 1, quantity: 2 }]);
    await paymentsService.pay(order.id, 'cash');
    const today = new Date().toISOString().slice(0, 10);
    const report = await ordersService.salesSummary(today, today);
    assert.strictEqual(report.count, 1);
    assert.strictEqual(report.total, order.total);
    assert.deepStrictEqual(report.bestsellers[0], { id: 1, name: PRODUCTS[0].name, quantity: 2, sales: order.total });
    assert.strictEqual((await ordersService.salesSummary('2020-01-01', '2020-01-02')).count, 0);
    await rejects(ordersService.salesSummary('2026-02-31', ''), /rango de fechas/);
  });
  await test('el catálogo devuelve productos y busca por id', async () => {
    assert.strictEqual((await catalogService.list()).length, PRODUCTS.length);
    assert.strictEqual((await catalogService.get(999)), null);
  });
  await test('el carrito respeta el stock', async () => {
    for (let i = 0; i < 10; i++) await cartService.add(1);
    await rejects(cartService.add(1), /No hay más existencias/);
    await cartService.change(1, -3);
    assert.strictEqual((await cartService.priced())[0].quantity, 7);
    await rejects(cartService.change(1, 0), /entero distinto de cero/);
    await rejects(cartService.change(1, 1.5), /entero distinto de cero/);
  });
  await test('el carrito consulta el precio real y ajusta cantidades obsoletas', async () => {
    rawStorage('iluminados:cart', JSON.stringify([{ id: 1, quantity: 99, price: 0.01 }, { id: 777, quantity: 1 }]));
    const lines = await cartService.priced();
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].price, PRODUCTS[0].price);
    assert.strictEqual(lines[0].quantity, 10);
  });
  await test('cada cuenta tiene su carrito y conserva el carrito invitado al iniciar sesión', async () => {
    await cartService.add(1);
    await admin();
    assert.strictEqual(await cartService.claimGuestCart(), false);
    await cartService.add(2);
    authService.logout();
    await registroService.register({ nombre: 'Beto', email: 'beto@x.com', password: 'secreto2' });
    await authService.login('beto@x.com', 'secreto2');
    assert.deepStrictEqual(await cartService.priced(), []);
    await cartService.add(3);
    authService.logout();
    await authService.login('ADMIN', '123456789');
    assert.deepStrictEqual((await cartService.priced()).map(line => line.id).sort(), [1, 2]);
    authService.logout();
    await authService.login('beto@x.com', 'secreto2');
    assert.deepStrictEqual((await cartService.priced()).map(line => line.id), [3]);
  });
  await test('solo el admin reabastece, con cantidades válidas', async () => {
    await cliente();
    await rejects(inventoryService.restock(1, 5), /administrador/);
    authService.logout(); await authService.login('ADMIN', '123456789');
    await inventoryService.restock(1, 5);
    assert.strictEqual((await inventoryService.all())[1], 15);
    await rejects(inventoryService.restock(1, -2), /entero/);
    await rejects(inventoryService.restock(1, 2.5), /entero/);
    await rejects(inventoryService.restock(999, 1), /no encontrado/);
  });

  console.log('Métodos de pago');
  await test('valida tarjetas (Luhn, fecha, vencida, duplicada)', async () => {
    await admin();
    await rejects(paymentMethodsService.add({ ...visa, numero: '4242 4242 4242 4241' }), /no es válido/);
    await rejects(paymentMethodsService.add({ ...visa, numero: 'abc 4242 4242 4242 4242' }), /solo debe contener dígitos/);
    await rejects(paymentMethodsService.add({ ...visa, vence: '13/30' }), /MM\/AA/);
    await rejects(paymentMethodsService.add({ ...visa, vence: '01/20' }), /vencida/);
    const now = new Date();
    const currentExpiry = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;
    assert.strictEqual((await paymentMethodsService.add({ ...visa, vence: currentExpiry })).vence, currentExpiry);
    const m = await paymentMethodsService.add(visa);
    assert.strictEqual(m.etiqueta, 'Visa •••• 4242');
    assert.ok(!JSON.stringify(m).includes('4242 4242'));
    await rejects(paymentMethodsService.add(visa), /ya está guardada/);
  });
  await test('cada usuario ve solo sus tarjetas y pide sesión', async () => {
    await cliente(); await paymentMethodsService.add(visa);
    authService.logout(); await authService.login('ADMIN', '123456789');
    assert.strictEqual((await paymentMethodsService.list()).length, 1);
    authService.logout();
    await rejects(paymentMethodsService.list(), /Inicia sesión/);
  });
  await test('una tarjeta Mastercard se identifica y se puede eliminar', async () => {
    await admin();
    const card = await paymentMethodsService.add({ titular: 'Ana', numero: '5555 5555 5555 4444', vence: '12/40' });
    assert.strictEqual(card.marca, 'Mastercard');
    await paymentMethodsService.remove(card.id);
    assert.strictEqual((await paymentMethodsService.list()).length, 1);
    await rejects(paymentMethodsService.remove(card.id), /No se encontró/);
  });

  console.log('Pedidos, pagos e inventario');
  await test('crear pedido exige sesión y toma precios del catálogo', async () => {
    await rejects(ordersService.create([{ id: 1, quantity: 1 }]), /Inicia sesión/);
    await admin();
    await rejects(ordersService.create([]), /vacío/);
    await rejects(ordersService.create([{ id: 1, quantity: 0 }]), /Cantidad/);
    await rejects(ordersService.create([{ id: 1, quantity: 99 }]), /Stock insuficiente/);
    const o = await ordersService.create([{ id: 1, quantity: 2, price: 0.01 }]);
    assert.strictEqual(o.total, PRODUCTS[0].price * 2);
    assert.strictEqual(o.estado, 'pendiente_pago');
    assert.strictEqual(o.id, 'PED-0001');
  });
  await test('pago en efectivo: pedido pagado y stock descontado solo entonces', async () => {
    await admin();
    const o = await ordersService.create([{ id: 1, quantity: 3 }]);
    assert.strictEqual((await inventoryService.all())[1], 10);
    const r = await paymentsService.pay(o.id, 'cash');
    assert.strictEqual(r.ok, true);
    assert.strictEqual((await ordersService.get(o.id)).estado, 'pagado');
    assert.strictEqual((await inventoryService.all())[1], 7);
    await rejects(paymentsService.pay(o.id, 'cash'), /ya está pagado/);
    assert.strictEqual((await inventoryService.all())[1], 7);
  });
  await test('un cliente compra con su tarjeta y solo ve su pedido', async () => {
    await cliente();
    const card = await paymentMethodsService.add(visa);
    const order = await ordersService.create([{ id: 1, quantity: 1 }]);
    assert.strictEqual(order.cliente, 'Beto');
    assert.deepStrictEqual((await ordersService.list()).map(item => item.id), [order.id]);
    assert.strictEqual((await paymentsService.pay(order.id, card.id)).ok, true);
    assert.strictEqual((await ordersService.get(order.id)).estado, 'pagado');
    assert.strictEqual((await inventoryService.all())[1], 9);
  });
  await test('tarjeta rechazada deja el pedido reintentable sin tocar el stock', async () => {
    await admin();
    const bad = await paymentMethodsService.add(declinada), good = await paymentMethodsService.add(visa);
    const o = await ordersService.create([{ id: 2, quantity: 1 }]);
    const r = await paymentsService.pay(o.id, bad.id);
    assert.strictEqual(r.ok, false);
    let cur = await ordersService.get(o.id);
    assert.strictEqual(cur.estado, 'pago_rechazado'); assert.ok(cur.error);
    assert.strictEqual((await inventoryService.all())[2], 10);
    assert.strictEqual((await paymentsService.pay(o.id, good.id)).ok, true);
    cur = await ordersService.get(o.id);
    assert.strictEqual(cur.estado, 'pagado'); assert.strictEqual(cur.error, '');
    assert.strictEqual((await inventoryService.all())[2], 9);
  });
  await test('método de pago inexistente o ajeno se rechaza', async () => {
    await cliente(); const m = await paymentMethodsService.add(visa);
    authService.logout(); await authService.login('ADMIN', '123456789');
    const o = await ordersService.create([{ id: 1, quantity: 1 }]);
    await rejects(paymentsService.pay(o.id, m.id), /método de pago válido/);
    await rejects(paymentsService.pay(o.id, 'nada'), /método de pago válido/);
  });
  await test('el webhook es idempotente y valida el importe', async () => {
    await admin();
    const o = await ordersService.create([{ id: 1, quantity: 2 }]);
    const evt = { id: 'evt_1', type: 'payment_intent.succeeded', data: { paymentId: 'pi_1', orderId: o.id, amount: o.total, method: 'Efectivo' } };
    assert.strictEqual((await paymentsService.handleWebhook(evt)).processed, true);
    assert.strictEqual((await paymentsService.handleWebhook(evt)).processed, false);
    assert.strictEqual((await inventoryService.all())[1], 8);
    const o2 = await ordersService.create([{ id: 1, quantity: 1 }]);
    await paymentsService.handleWebhook({ id: 'evt_2', type: 'payment_intent.succeeded', data: { paymentId: 'pi_2', orderId: o2.id, amount: 0.01, method: 'x' } });
    const cur = await ordersService.get(o2.id);
    assert.strictEqual(cur.estado, 'pago_rechazado');
    assert.strictEqual((await inventoryService.all())[1], 8);
    assert.strictEqual((await paymentsService.handleWebhook({ id: 'evt_3', type: 'otro', data: { orderId: o2.id } })).processed, false);
  });
  await test('cancelar: solo pedidos no pagados', async () => {
    await admin();
    const a = await ordersService.create([{ id: 1, quantity: 1 }]);
    await ordersService.cancel(a.id);
    assert.strictEqual((await ordersService.get(a.id)).estado, 'cancelado');
    await rejects(ordersService.cancel(a.id), /ya estaba cancelado/);
    await rejects(paymentsService.pay(a.id, 'cash'), /cancelado/);
    const b = await ordersService.create([{ id: 1, quantity: 1 }]);
    await paymentsService.pay(b.id, 'cash');
    await rejects(ordersService.cancel(b.id), /pagado/);
  });
  await test('un cliente no ve ni toca pedidos ajenos; el admin ve todos', async () => {
    await cliente();
    const o = await ordersService.create([{ id: 1, quantity: 1 }]);
    authService.logout(); await registroService.register({ nombre: 'Caro', email: 'caro@x.com', password: 'secreto3' });
    await authService.login('caro@x.com', 'secreto3');
    assert.strictEqual((await ordersService.list()).length, 0);
    assert.strictEqual(await ordersService.get(o.id), null);
    await rejects(ordersService.cancel(o.id), /no encontrado/);
    await rejects(paymentsService.pay(o.id, 'cash'), /no encontrado/);
    authService.logout(); await authService.login('ADMIN', '123456789');
    assert.strictEqual((await ordersService.list()).length, 1);
    await paymentsService.pay(o.id, 'cash');
  });
  await test('no se puede pagar si el stock se agotó después de crear el pedido', async () => {
    await admin();
    const a = await ordersService.create([{ id: 1, quantity: 8 }]);
    const b = await ordersService.create([{ id: 1, quantity: 8 }]);
    await paymentsService.pay(a.id, 'cash');
    await rejects(paymentsService.pay(b.id, 'cash'), /Stock insuficiente/);
    assert.strictEqual((await ordersService.get(b.id)).estado, 'pendiente_pago');
    assert.strictEqual((await inventoryService.all())[1], 2);
  });
  await test('el almacenamiento funciona aunque localStorage falle', async () => {
    const real = localStorage;
    localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
    try { await admin(); assert.strictEqual(authService.current().nombre, 'Administrador'); }
    finally { localStorage = real; }
  });

  console.log(`\n${pass} pruebas correctas`);
}

const code = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const nodeSha = async t => require('crypto').createHash('sha256').update(t).digest('hex');
const resetStorage = () => { ls = {}; };
const rawStorage = (k, v) => { if (v === undefined) return ls[k]; ls[k] = v; };
ctx.__args = [assert, resetStorage, rawStorage, nodeSha];
vm.runInContext(`${code}\n;(${suite.toString()})(...__args).catch(e => { console.log('ERROR', e); process.exitCode = 1; });`, ctx);
