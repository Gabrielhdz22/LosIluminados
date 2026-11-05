// ---------- Estado ----------
let activeTab = 'catalogo', cartOpen = false, mobileOpen = false;
let user = null, products = [], stock = {}, cart = [], orders = [], methods = [];
let authModal = null;      // 'login' | 'register' | null
let afterLogin = null;     // acción pendiente tras iniciar sesión
let checkout = null;       // { orderId, addingCard }
let productEditor = null, receiptOrderId = null, expandedOrderId = null;
let reportSummary = { from: '', to: '', count: 0, total: 0, orders: [], bestsellers: [] };
let catalogFilters = { query: '', categoria: '', franquicia: '', available: false };
let payMethod = 'cash';
let adminTapCount = 0, adminTapTimer;

const icons = { cart: '🛒', menu: '☰', close: '✕', package: '▣', list: '☷', shield: '⚠', right: '›', plus: '+', minus: '−', trash: '🗑', skull: '☠' };
const ESTADOS = {
  pendiente_pago: ['Pendiente de pago', 'text-amber-500 border-amber-700/50 bg-amber-900/10'],
  pago_rechazado: ['Pago rechazado', 'text-red-500 border-red-800/50 bg-red-900/10'],
  pagado: ['Pagado', 'text-emerald-500 border-emerald-800/50 bg-emerald-900/10'],
  cancelado: ['Cancelado', 'text-neutral-500 border-neutral-700 bg-neutral-900']
};

const money = n => `$${n.toFixed(2)}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = id => (document.getElementById(id) || {}).value || '';
const cartTotal = () => cartService.total(cart);
const cartCount = () => cart.reduce((s, i) => s + i.quantity, 0);

let toastTimer;
function toast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.innerHTML = `<div class="px-4 py-3 rounded border shadow-xl text-sm ${ok ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'bg-red-950 border-red-700 text-red-200'}">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// Ejecuta una acción evitando dobles clics; si falla, avisa y vuelve a sincronizar el estado
// (por ejemplo, sesión vencida o stock que cambió).
let busy = false;
async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); }
  catch (e) {
    toast(e.message || 'Ocurrió un error.', false);
    // No se re-dibuja si hay un formulario abierto, para no borrar lo que la persona escribió.
    try { await refresh(!!authModal || !!(checkout && checkout.addingCard)); } catch (e2) {}
  }
  finally { busy = false; }
}

async function refresh(silent = false) {
  user = authService.current();
  if (!tabsForUser().some(([id]) => id === activeTab)) activeTab = 'catalogo';
  [products, stock, cart] = await Promise.all([
    catalogService.list({ includeInactive: !!user && user.rol === 'admin' }),
    inventoryService.all(), cartService.priced()
  ]);
  orders = user ? await ordersService.list() : [];
  methods = user ? await paymentMethodsService.list() : [];
  if (user && user.rol === 'admin') reportSummary = await ordersService.salesSummary(reportSummary.from, reportSummary.to);
  if (!silent) render();
}

// ---------- Acciones ----------
function tabsForUser() {
  return user && user.rol === 'admin'
    ? TABS
    : TABS.filter(([id]) => id === 'catalogo' || id === 'pedidos');
}

function setTab(t) {
  if (!tabsForUser().some(([id]) => id === t)) {
    toast('No tienes permiso para acceder a esa sección.', false);
    t = 'catalogo';
  }
  activeTab = t; mobileOpen = false; render();
}
function toggleCart(v) { cartOpen = v; render(); }

const addToCart = id => run(async () => { await cartService.add(id); cartOpen = true; await refresh(); });
const updateQuantity = (id, d) => run(async () => { await cartService.change(id, d); await refresh(); });
const removeFromCart = id => run(async () => { await cartService.remove(id); await refresh(); });

function openAuth(mode) { authModal = mode; mobileOpen = false; render(); }
function tapBrand() {
  setTab('catalogo');
  adminTapCount++;
  clearTimeout(adminTapTimer);
  if (adminTapCount >= 5) {
    adminTapCount = 0;
    openAuth('login');
    return;
  }
  adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 1500);
}
function closeAuth() { authModal = null; afterLogin = null; render(); }
function logout() { authService.logout(); checkout = null; activeTab = 'catalogo'; mobileOpen = false; refresh(); toast('Sesión cerrada.'); }

const submitAuth = () => run(async () => {
  const email = val('auth-email'), password = val('auth-pass');
  if (authModal === 'register') {
    await registroService.register({ nombre: val('auth-name'), email, password });
  }
  const u = await authService.login(email, password);
  const guestCartAdjusted = await cartService.claimGuestCart();
  authModal = null;
  toast(`Bienvenido, ${u.nombre}.`);
  const next = afterLogin; afterLogin = null;
  await refresh();
  if (guestCartAdjusted) toast('Ajustamos tu carrito a las existencias disponibles.', false);
  if (next === 'checkout') startCheckout();
});

function startCheckout() {
  cartOpen = false;
  if (!user) { afterLogin = 'checkout'; authModal = 'login'; render(); return; }
  checkout = { orderId: null, addingCard: false }; payMethod = 'cash'; render();
}
function payExisting(orderId) { checkout = { orderId, addingCard: false }; payMethod = 'cash'; render(); }
function closeCheckout() { checkout = null; render(); }
function toggleAddCard(v) { checkout.addingCard = v; render(); }

const saveCard = () => run(async () => {
  const m = await paymentMethodsService.add({ titular: val('card-name'), numero: val('card-number'), vence: val('card-exp') });
  payMethod = m.id; checkout.addingCard = false; await refresh(); toast('Tarjeta guardada.');
});
const deleteCard = id => run(async () => { await paymentMethodsService.remove(id); if (payMethod === id) payMethod = 'cash'; await refresh(); });

function formatCardNumber(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 19);
  input.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatCardExpiry(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 4);
  input.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

const confirmPay = () => run(async () => {
  let orderId = checkout.orderId;
  if (!orderId) {
    const order = await ordersService.create(cart);
    orderId = checkout.orderId = order.id;
    await cartService.clear();
  }
  const res = await paymentsService.pay(orderId, payMethod);
  await refresh();
  if (res.ok) { checkout = null; activeTab = 'pedidos'; receiptOrderId = orderId; render(); }
  else toast(`${res.reason} Elige otro método e inténtalo de nuevo.`, false);
});

const cancelOrder = id => run(async () => { await ordersService.cancel(id); await refresh(); toast(`Pedido ${id} cancelado.`); });
const restock = (id, q) => run(async () => { await inventoryService.restock(id, q); await refresh(); toast('Inventario actualizado.'); });
const saveStock = id => run(async () => {
  const quantity = Number(val(`stock-${id}`));
  await inventoryService.setQuantity(id, quantity);
  await refresh();
  toast('Existencias actualizadas.');
});
function restockCustom(id) {
  const value = window.prompt('¿Cuántas unidades deseas agregar? (1–1000)');
  if (value === null) return;
  const quantity = Number(value);
  if (!Number.isInteger(quantity)) { toast('Ingresa una cantidad entera.', false); return; }
  return restock(id, quantity);
}
function openProductEditor(id = null) {
  productEditor = id === null ? { id: null } : { ...products.find(p => p.id === id) };
  render();
}
function closeProductEditor() { productEditor = null; render(); }
const submitProduct = () => run(async () => {
  const isNew = productEditor.id === null;
  const initialStock = Number(val('product-stock'));
  if (isNew && (!Number.isInteger(initialStock) || initialStock < 0 || initialStock > 1000000)) {
    throw new Error('Las existencias iniciales deben ser un entero entre 0 y 1000000.');
  }
  const input = {
    name: val('product-name'), price: val('product-price'), categoria: val('product-category'),
    franquicia: val('product-franchise'), sku: val('product-sku'),
    description: val('product-description'), image: val('product-image')
  };
  let saved;
  if (isNew) {
    saved = await catalogService.create(input);
    await inventoryService.setQuantity(saved.id, initialStock);
  } else {
    saved = await catalogService.update(productEditor.id, input);
  }
  productEditor = null;
  await refresh();
  toast(isNew ? 'Producto creado.' : 'Producto actualizado.');
});
const toggleProduct = id => run(async () => {
  const product = await catalogService.get(id);
  await catalogService.setActive(id, !product.activo);
  await refresh();
  toast(product.activo ? 'Producto desactivado; se conserva su historial e inventario.' : 'Producto activado.');
});
const setReportDates = () => run(async () => {
  const from = val('report-from'), to = val('report-to');
  reportSummary = await ordersService.salesSummary(from, to);
  render();
});
function exportReport() {
  if (!user || user.rol !== 'admin') { toast('Solo el administrador puede exportar reportes.', false); return; }
  const rows = [['Pedido', 'Fecha de pago', 'Cliente', 'Estado', 'Producto', 'SKU', 'Cantidad', 'Precio unitario', 'Importe']];
  const csvValue = value => {
    const text = String(value);
    return `"${( /^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  reportSummary.orders.forEach(order => order.items.forEach(item => rows.push([
    order.id, (order.pago && order.pago.pagado || order.creado).slice(0, 10), order.cliente,
    order.estado, item.name, item.sku, item.quantity, item.price.toFixed(2), (item.price * item.quantity).toFixed(2)
  ])));
  const csv = '\uFEFF' + rows.map(row => row.map(csvValue).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-ventas-${reportSummary.from || 'inicio'}-${reportSummary.to || 'hoy'}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dismissReceipt() { receiptOrderId = null; render(); }
function toggleOrderDetails(id) { expandedOrderId = expandedOrderId === id ? null : id; render(); }
function renderCatalogGrid() {
  const results = document.getElementById('catalog-results');
  if (results) results.innerHTML = catalogCardsHTML();
  const count = document.getElementById('catalog-result-count');
  if (count) count.textContent = String(filteredProducts().length).padStart(2, '0');
}

// ---------- Vistas ----------
const navIcon = id => id === 'catalogo' ? icons.list : id === 'pedidos' ? icons.package : id === 'inventario' ? icons.cart : id === 'reportes' ? '▤' : icons.shield;

function navHTML() {
  const tabs = tabsForUser();
  const tabLabel = (id, label) => id === 'pedidos' && user && user.rol !== 'admin' ? 'Mis pedidos' : label;
  const userBox = user
    ? `<span class="hidden lg:inline text-xs text-neutral-400 font-mono">${esc(user.nombre)} <span class="text-amber-600">[${user.rol === 'admin' ? 'ADMIN' : 'CLIENTE'}]</span></span>
       <button onclick="logout()" class="hidden md:block text-xs uppercase tracking-wider text-neutral-400 hover:text-red-500">Salir</button>`
    : `<button onclick="openAuth('login')" class="hidden md:block px-3 py-2 text-xs uppercase font-semibold tracking-wider rounded border border-red-900/50 text-red-500 hover:bg-red-950/40">Ingresar</button>`;
  return `
<nav class="sticky top-0 z-40 w-full bg-neutral-950/80 backdrop-blur-md border-b border-red-900/30 shadow-lg">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="flex justify-between items-center h-20">
   <div class="flex items-center gap-3 cursor-pointer" onclick="tapBrand()">
    <div class="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-amber-700/50 shadow-lg overflow-hidden">
      <img src="assets/img/logo.png" alt="Los Iluminados" class="w-full h-full object-cover">
    </div>
    <span class="font-serif text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-amber-600 to-red-800 uppercase">Los Iluminados</span>
   </div>
   <div class="hidden md:flex space-x-1">
    ${tabs.map(([id, label]) => `
      <button onclick="setTab('${id}')" class="flex items-center gap-2 px-4 py-2 rounded-md transition-all uppercase text-xs font-semibold tracking-wider ${activeTab === id ? 'bg-red-950/40 text-red-500 border border-red-900/50' : 'text-neutral-400 hover:text-amber-500 hover:bg-neutral-900'}">
       <span>${navIcon(id)}</span>${tabLabel(id, label)}
      </button>`).join('')}
   </div>
   <div class="flex items-center gap-4">
    ${userBox}
    <button onclick="toggleCart(true)" class="relative p-2 text-neutral-400 hover:text-red-500 transition-colors text-2xl">
      ${icons.cart}${cartCount() > 0 ? `<span class="absolute top-0 right-0 -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-700 text-[10px] font-bold text-white border border-black">${cartCount()}</span>` : ''}
    </button>
    <button class="md:hidden p-2 text-neutral-400 hover:text-white text-xl" onclick="mobileOpen=!mobileOpen;render()">${mobileOpen ? icons.close : icons.menu}</button>
   </div>
  </div>
 </div>
 ${mobileOpen ? `<div class="md:hidden bg-neutral-900 border-b border-red-900/30"><div class="px-2 pt-2 pb-3 space-y-1">
 ${tabs.map(([id, label]) => `
 <button onclick="setTab('${id}')" class="flex items-center gap-3 w-full px-3 py-3 rounded-md uppercase text-sm font-bold ${activeTab === id ? 'bg-red-950/50 text-red-500 border-l-4 border-red-600' : 'text-neutral-400 hover:bg-neutral-800'}">${navIcon(id)}${tabLabel(id, label)}</button>`).join('')}
 ${user
   ? `<button onclick="logout()" class="w-full text-left px-3 py-3 uppercase text-sm font-bold text-neutral-400">Salir (${esc(user.nombre)})</button>`
   : `<button onclick="openAuth('login')" class="w-full text-left px-3 py-3 uppercase text-sm font-bold text-red-500">Ingresar</button>`}
 </div></div>` : ''}
</nav>`;
}

function catalogHTML() {
  return `
<div>
 <section class="catalog-hero">
  <div class="catalog-hero__image" aria-hidden="true"></div>
  <div class="catalog-hero__shade" aria-hidden="true"></div>
  <div class="catalog-hero__content">
   <div class="catalog-hero__copy">
    <p class="catalog-eyebrow"><span></span> Colección de culto · Resident Evil</p>
    <h1>Encuentra tu próxima <em>pieza de colección.</em></h1>
    <p class="catalog-hero__lead">Figuras seleccionadas para fans que saben lo que buscan. Ediciones memorables, detalles excepcionales.</p>
    <button onclick="document.getElementById('catalogo').scrollIntoView({behavior:'smooth'})" class="catalog-hero__button">Explorar colección <span>↓</span></button>
   </div>
   <div class="catalog-hero__note"><span>01 — 05</span><span>Una colección hecha para quedarse</span></div>
  </div>
 </section>
 <section id="catalogo" class="catalog-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="catalog-section__head">
   <div><p class="catalog-eyebrow"><span></span> Selección curada</p><h2>La colección</h2></div>
   <span class="catalog-count" id="catalog-result-count">${String(filteredProducts().length).padStart(2, '0')} <span>PIEZAS</span></span>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
   <input id="catalog-search" type="search" value="${esc(catalogFilters.query)}" oninput="catalogFilters.query=this.value;renderCatalogGrid()" placeholder="Buscar figura, SKU o franquicia" aria-label="Buscar productos" class="${inputCls}">
   <select onchange="catalogFilters.categoria=this.value;renderCatalogGrid()" aria-label="Filtrar por categoría" class="${inputCls}">
    <option value="">Todas las categorías</option>${[...new Set(products.filter(p => p.activo !== false).map(p => p.categoria))].sort().map(v => `<option value="${esc(v)}" ${catalogFilters.categoria === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
   </select>
   <select onchange="catalogFilters.franquicia=this.value;renderCatalogGrid()" aria-label="Filtrar por franquicia" class="${inputCls}">
    <option value="">Todas las franquicias</option>${[...new Set(products.filter(p => p.activo !== false).map(p => p.franquicia))].sort().map(v => `<option value="${esc(v)}" ${catalogFilters.franquicia === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
   </select>
   <label class="flex items-center gap-3 p-3 border border-neutral-800 bg-neutral-900 text-sm text-neutral-300"><input type="checkbox" ${catalogFilters.available ? 'checked' : ''} onchange="catalogFilters.available=this.checked;renderCatalogGrid()" class="accent-red-700">Solo disponibles</label>
  </div>
  <div id="catalog-results" class="catalog-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">${catalogCardsHTML()}</div>
  <div class="catalog-footnote"><span>LOS ILUMINADOS — OBJETOS PARA QUIENES RECUERDAN CADA DETALLE</span><span>© ${new Date().getFullYear()}</span></div>
 </section>
</div>`;
}

function filteredProducts() {
  const query = catalogFilters.query.trim().toLocaleLowerCase();
  return products.filter(p => p.activo !== false)
    .filter(p => !query || [p.name, p.sku, p.categoria, p.franquicia, p.description].some(v => v.toLocaleLowerCase().includes(query)))
    .filter(p => !catalogFilters.categoria || p.categoria === catalogFilters.categoria)
    .filter(p => !catalogFilters.franquicia || p.franquicia === catalogFilters.franquicia)
    .filter(p => !catalogFilters.available || (stock[p.id] || 0) > 0);
}

function catalogCardsHTML() {
  const visible = filteredProducts();
  if (!visible.length) return '<p class="col-span-full py-16 text-center text-neutral-500">No encontramos productos con esos filtros.</p>';
  return visible.map(p => {
     const left = stock[p.id] || 0;
     return `
   <article class="product-card group">
    <div class="product-card__media">
     <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" class="product-card__image">
     <span class="product-card__sku">${esc(p.sku)}</span>
     <span class="product-card__stock ${left === 0 ? 'is-sold-out' : ''}">${left === 0 ? 'Agotado' : 'Disponible'}</span>
     <span class="product-card__index">${String(p.id).padStart(2, '0')}</span>
    </div>
    <div class="product-card__body">
     <div class="product-card__meta">${esc(p.franquicia)} <span>·</span> ${esc(p.categoria)}</div>
     <h3>${esc(p.name)}</h3>
     <p class="product-card__description">${esc(p.description)}</p>
     <div class="product-card__footer">
      <div><span class="product-card__price">${money(p.price)}</span><span class="product-card__currency"> MXN</span></div>
      <button ${left === 0 ? 'disabled' : ''} onclick="addToCart(${p.id})" class="product-card__button">${left === 0 ? 'Agotado' : 'Agregar'} <span>${icons.plus}</span></button>
     </div>
    </div>
   </article>`;
  }).join('');
}

function loginRequiredHTML(title) {
  return `<div class="flex items-center justify-center h-[60vh]"><div class="text-center px-4">
   <div class="text-neutral-800 text-6xl mb-4">${icons.skull}</div>
   <h2 class="text-2xl font-serif text-neutral-500 uppercase tracking-widest">${title}</h2>
   <p class="text-neutral-500 mt-2 mb-6 text-sm uppercase tracking-widest">Inicia sesión para continuar</p>
   <button onclick="openAuth('login')" class="px-6 py-3 bg-red-800 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded">Ingresar</button>
  </div></div>`;
}

function sectionHead(title, tag) {
  return `<div class="flex justify-between items-end mb-10 border-b border-neutral-800 pb-4">
   <h2 class="text-2xl font-serif text-neutral-100 uppercase tracking-widest flex items-center gap-2"><span class="w-8 h-1 bg-red-700"></span>${title}</h2>
   <span class="text-sm text-amber-600 font-mono tracking-widest">${tag}</span></div>`;
}

function ordersHTML() {
  if (!user) return loginRequiredHTML('Pedidos');
  return `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
  ${sectionHead(user.rol === 'admin' ? 'Ventas' : 'Mis pedidos', `[${orders.length} ${user.rol === 'admin' ? 'VENTAS' : 'PEDIDOS'}]`)}
  ${orders.length === 0 ? `<p class="text-center text-neutral-600 uppercase tracking-widest text-sm py-16">Aún no hay ventas registradas</p>` : `
  <div class="space-y-4">
   ${orders.map(o => {
     const [label, cls] = ESTADOS[o.estado];
     const open = o.estado === 'pendiente_pago' || o.estado === 'pago_rechazado';
     return `
   <div class="bg-neutral-900 rounded-lg border border-neutral-800 p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
    <div class="space-y-1">
     <div class="flex items-center gap-3 flex-wrap"><span class="font-mono text-amber-500 font-bold">${o.id}</span>
      <span class="px-2 py-1 text-[10px] font-mono uppercase tracking-widest rounded border ${cls}">${label}</span></div>
     <p class="text-sm text-neutral-300">${o.items.map(i => `${i.quantity}× ${esc(i.name)}`).join(', ')}</p>
     <p class="text-xs text-neutral-600 font-mono">${new Date(o.creado).toLocaleString('es-MX')} · ${user.rol === 'admin' ? 'Cliente' : 'Compra'}: ${esc(o.cliente || o.cajero)}${o.pago ? ' · Pago: ' + esc(o.pago.metodo) : ''}</p>
     ${o.error ? `<p class="text-xs text-red-500">${esc(o.error)}</p>` : ''}
     ${expandedOrderId === o.id ? `<div class="mt-4 border-t border-neutral-800 pt-3 space-y-2">${o.items.map(i => `<div class="flex justify-between gap-4 text-xs"><span>${i.quantity} × ${esc(i.name)} <span class="text-neutral-600">${esc(i.sku)}</span></span><span>${money(i.price * i.quantity)}</span></div>`).join('')}<div class="flex justify-between border-t border-neutral-800 pt-2 text-sm"><span>Total</span><strong class="text-amber-500">${money(o.total)}</strong></div>${o.pago ? `<p class="text-xs text-neutral-500">Pagado el ${new Date(o.pago.pagado).toLocaleString('es-MX')} · Referencia ${esc(o.pago.paymentId)}</p>` : ''}</div>` : ''}
    </div>
    <div class="flex items-center gap-3">
     <span class="text-xl font-bold text-amber-500 font-mono">${money(o.total)}</span>
     <button onclick="toggleOrderDetails('${o.id}')" class="px-3 py-2 border border-neutral-700 text-neutral-300 text-xs uppercase tracking-widest rounded">${expandedOrderId === o.id ? 'Ocultar' : 'Detalle'}</button>
     ${open ? `<button onclick="payExisting('${o.id}')" class="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded">${o.estado === 'pago_rechazado' ? 'Reintentar' : 'Pagar'}</button>
     <button onclick="cancelOrder('${o.id}')" class="px-3 py-2 border border-neutral-700 text-neutral-400 hover:text-red-500 text-xs uppercase tracking-widest rounded">Cancelar</button>` : ''}
    </div>
   </div>`;
   }).join('')}
  </div>`}
 </div>`;
}

function inventoryHTML() {
  if (!user) return loginRequiredHTML('Inventario');
  if (user.rol !== 'admin') {
    return `<div class="flex items-center justify-center h-[60vh]"><div class="text-center px-4"><h2 class="text-2xl font-serif text-neutral-500 uppercase tracking-widest">Acceso restringido</h2><p class="text-neutral-500 mt-2 text-sm">El inventario es exclusivo para el encargado.</p><button onclick="setTab('catalogo')" class="mt-6 px-6 py-3 bg-red-800 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded">Volver al catálogo</button></div></div>`;
  }
  return `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
  ${sectionHead('Productos e inventario', `[${products.filter(p => p.activo !== false).length} ACTIVOS · ${products.reduce((s, p) => s + (stock[p.id] || 0), 0)} UNIDADES]`)}
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
   <p class="text-xs text-neutral-500 uppercase tracking-widest">Administra el catálogo, disponibilidad y existencias.</p>
   <button onclick="openProductEditor()" class="px-5 py-3 bg-red-800 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded">+ Nuevo producto</button>
  </div>
  <div class="space-y-3">
   ${products.map(p => {
     const left = stock[p.id] || 0;
     return `
   <div class="bg-neutral-900 rounded-lg border ${p.activo === false ? 'border-neutral-800 opacity-70' : 'border-neutral-800'} p-4 flex flex-col lg:flex-row lg:items-center gap-4">
    <div class="flex items-center gap-4 flex-grow min-w-0">
     <div class="w-16 h-16 bg-black rounded overflow-hidden flex-shrink-0 border border-neutral-800"><img src="${esc(p.image)}" alt="${esc(p.name)}" class="w-full h-full object-cover grayscale opacity-80"></div>
     <div class="min-w-0"><h4 class="text-sm font-bold text-neutral-200 truncate">${esc(p.name)} ${p.activo === false ? '<span class="text-xs text-red-400">· INACTIVO</span>' : ''}</h4><span class="text-xs text-neutral-600 font-mono">${esc(p.sku)} · ${money(p.price)}</span></div>
    </div>
    <div class="flex items-center gap-2">
     <label for="stock-${p.id}" class="text-[10px] uppercase tracking-widest text-neutral-500">Existencias</label>
     <input id="stock-${p.id}" type="number" min="0" max="1000000" value="${left}" class="w-24 bg-black border border-neutral-700 p-2 text-center font-mono text-neutral-200" aria-label="Existencias de ${esc(p.name)}">
     <button onclick="saveStock(${p.id})" class="px-3 py-2 border border-neutral-700 text-neutral-300 hover:border-amber-700 text-xs uppercase rounded">Guardar</button>
    </div>
    <div class="flex gap-2">
     <button onclick="restock(${p.id},5)" class="px-3 py-2 border border-neutral-700 text-neutral-300 hover:border-red-700 text-xs font-mono rounded">+5</button>
     <button onclick="restock(${p.id},10)" class="px-3 py-2 border border-neutral-700 text-neutral-300 hover:border-red-700 text-xs font-mono rounded">+10</button>
     <button onclick="openProductEditor(${p.id})" class="px-3 py-2 border border-neutral-700 text-neutral-300 hover:text-amber-500 text-xs uppercase rounded">Editar</button>
     <button onclick="toggleProduct(${p.id})" class="px-3 py-2 border border-neutral-700 ${p.activo === false ? 'text-emerald-500' : 'text-red-400'} text-xs uppercase rounded">${p.activo === false ? 'Activar' : 'Desactivar'}</button>
    </div>
   </div>`;
   }).join('')}
  </div>
 </div>`;
}

function reportsHTML() {
  if (!user) return loginRequiredHTML('Reportes de ventas');
  if (user.rol !== 'admin') return '<div class="p-16 text-center text-neutral-500">Acceso restringido.</div>';
  const top = reportSummary.bestsellers.slice(0, 5);
  return `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
   ${sectionHead('Reportes de ventas', `[${reportSummary.count} VENTAS PAGADAS]`)}
   <div class="bg-neutral-900 border border-neutral-800 p-5 mb-8 flex flex-col md:flex-row md:items-end gap-4">
    <label class="flex-1 space-y-2"><span class="${labelCls}">Desde</span><input id="report-from" type="date" value="${esc(reportSummary.from)}" class="${inputCls}"></label>
    <label class="flex-1 space-y-2"><span class="${labelCls}">Hasta</span><input id="report-to" type="date" value="${esc(reportSummary.to)}" class="${inputCls}"></label>
    <button onclick="setReportDates()" class="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase tracking-widest rounded">Aplicar fechas</button>
    <button onclick="exportReport()" ${reportSummary.orders.length ? '' : 'disabled'} class="px-5 py-3 bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-widest rounded">Exportar CSV</button>
   </div>
   <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
    <div class="bg-neutral-900 border border-neutral-800 p-6"><p class="${labelCls}">Ventas totales</p><p class="mt-3 text-3xl text-amber-500 font-mono">${money(reportSummary.total)}</p><p class="mt-2 text-xs text-neutral-500">Solo pedidos pagados dentro del rango</p></div>
    <div class="bg-neutral-900 border border-neutral-800 p-6"><p class="${labelCls}">Pedidos completados</p><p class="mt-3 text-3xl text-neutral-100 font-mono">${reportSummary.count}</p><p class="mt-2 text-xs text-neutral-500">${reportSummary.from || 'Desde el inicio'} — ${reportSummary.to || 'Hasta hoy'}</p></div>
   </div>
   <div class="bg-neutral-900 border border-neutral-800 p-5 mb-10">
    <h3 class="font-serif text-xl text-neutral-100 mb-5">Productos más vendidos</h3>
    ${top.length ? `<div class="space-y-3">${top.map((item, index) => `<div class="flex items-center gap-4 border-b border-neutral-800 pb-3"><span class="text-amber-600 font-mono">0${index + 1}</span><span class="flex-grow">${esc(item.name)}</span><span class="text-neutral-400">${item.quantity} uds.</span><strong class="text-amber-500 font-mono">${money(item.sales)}</strong></div>`).join('')}</div>` : '<p class="text-sm text-neutral-500">No hay ventas pagadas en este rango.</p>'}
   </div>
   <h3 class="font-serif text-xl text-neutral-100 mb-4">Ventas incluidas</h3>
   <div class="space-y-3">${reportSummary.orders.length ? reportSummary.orders.map(order => `<div class="bg-neutral-900 border border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><strong class="text-amber-500 font-mono">${esc(order.id)}</strong><p class="text-sm text-neutral-300">${esc(order.cliente)} · ${new Date(order.pago && order.pago.pagado || order.creado).toLocaleString('es-MX')}</p><p class="text-xs text-neutral-500">${order.items.map(item => `${item.quantity}× ${esc(item.name)}`).join(', ')}</p></div><strong class="text-lg text-amber-500 font-mono">${money(order.total)}</strong></div>`).join('') : '<p class="text-sm text-neutral-500 py-6">Aún no hay ventas pagadas.</p>'}</div>
  </div>`;
}

function productEditorHTML() {
  if (!productEditor) return '';
  const editing = productEditor.id !== null;
  const p = productEditor;
  return modalShell(editing ? 'Editar producto' : 'Nuevo producto', 'Gestión de catálogo · acceso admin', 'closeProductEditor()', `
   <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <label class="space-y-2"><span class="${labelCls}">Nombre</span><input id="product-name" maxlength="100" value="${esc(p.name || '')}" class="${inputCls}"></label>
    <label class="space-y-2"><span class="${labelCls}">Precio (MXN)</span><input id="product-price" type="number" min="0.01" step="0.01" value="${p.price || ''}" class="${inputCls}"></label>
    <label class="space-y-2"><span class="${labelCls}">Categoría</span><input id="product-category" maxlength="60" value="${esc(p.categoria || '')}" class="${inputCls}"></label>
    <label class="space-y-2"><span class="${labelCls}">Franquicia</span><input id="product-franchise" maxlength="60" value="${esc(p.franquicia || '')}" class="${inputCls}"></label>
    <label class="space-y-2"><span class="${labelCls}">SKU</span><input id="product-sku" maxlength="30" value="${esc(p.sku || '')}" class="${inputCls}"></label>
    <label class="space-y-2"><span class="${labelCls}">Ruta de imagen</span><input id="product-image" maxlength="300" value="${esc(p.image || '')}" placeholder="assets/img/producto.jpg" class="${inputCls}"></label>
    ${editing ? '' : `<label class="space-y-2"><span class="${labelCls}">Existencias iniciales</span><input id="product-stock" type="number" min="0" max="1000000" value="0" class="${inputCls}"></label>`}
    <label class="space-y-2 sm:col-span-2"><span class="${labelCls}">Descripción</span><textarea id="product-description" maxlength="500" rows="3" class="${inputCls}">${esc(p.description || '')}</textarea></label>
   </div>
   <button onclick="submitProduct()" class="w-full py-3 bg-red-800 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded">${editing ? 'Guardar cambios' : 'Crear producto'}</button>`);
}

function receiptHTML() {
  if (!receiptOrderId) return '';
  const order = orders.find(item => item.id === receiptOrderId);
  if (!order) return '';
  return modalShell('Compra confirmada', `Pedido ${esc(order.id)}`, 'dismissReceipt()', `
   <div class="text-center"><div class="text-4xl text-emerald-500 mb-2">✓</div><p class="text-neutral-200">Tu pago fue aprobado.</p><p class="text-xs text-neutral-500 mt-1">${new Date(order.pago.pagado).toLocaleString('es-MX')}</p></div>
   <div class="space-y-3 border-y border-neutral-800 py-4">${order.items.map(item => `<div class="flex justify-between gap-4 text-sm"><span>${item.quantity} × ${esc(item.name)}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}<div class="flex justify-between pt-2 font-bold"><span>Total pagado</span><span class="text-amber-500">${money(order.total)}</span></div></div>
   <p class="text-xs text-neutral-500">Método: ${esc(order.pago.metodo)} · Referencia: ${esc(order.pago.paymentId)}</p>
   <button onclick="dismissReceipt()" class="w-full py-3 bg-red-800 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded">Ver mi historial de pedidos</button>`);
}

function placeholderHTML() {
  return `<div class="flex items-center justify-center h-[60vh]"><div class="text-center"><div class="text-neutral-800 text-6xl mb-4">${icons.skull}</div><h2 class="text-2xl font-serif text-neutral-600 uppercase tracking-widest">Devoluciones</h2><p class="text-neutral-500 mt-2 text-sm uppercase tracking-widest">Módulo en desarrollo</p></div></div>`;
}

function cartHTML() {
  return `
<div class="cart-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}" onclick="toggleCart(false)">
 <div class="cart-panel absolute top-0 right-0 w-full sm:w-96 h-full bg-neutral-950 border-l border-red-900/30 shadow-2xl flex flex-col transition-transform duration-500 ${cartOpen ? 'translate-x-0' : 'translate-x-full'}" onclick="event.stopPropagation()">
  <div class="cart-panel__header flex items-center justify-between p-5 border-b border-neutral-800 bg-black"><h2 class="text-lg font-serif font-bold text-neutral-200 uppercase tracking-widest flex items-center gap-2"><span class="text-red-600">${icons.cart}</span>Carrito</h2><button onclick="toggleCart(false)" class="text-neutral-500 hover:text-red-500 text-2xl">${icons.close}</button></div>
  <div class="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar">
   ${cart.length === 0 ? `<div class="flex flex-col items-center justify-center h-full text-neutral-600 space-y-4"><span class="text-5xl opacity-20">${icons.package}</span><p class="uppercase tracking-widest text-sm">El maletín está vacío</p></div>` :
   cart.map(i => `<div class="flex gap-4 bg-neutral-900 p-3 rounded border border-neutral-800 relative">
    <div class="w-20 h-20 bg-black rounded overflow-hidden flex-shrink-0 border border-neutral-800"><img src="${i.image}" alt="${i.name}" class="w-full h-full object-cover grayscale opacity-80"></div>
    <div class="flex flex-col flex-grow justify-between"><div><h4 class="text-sm font-bold text-neutral-200">${i.name}</h4><span class="text-xs text-amber-600 font-mono">${money(i.price)}</span></div>
    <div class="flex items-center justify-between"><div class="flex items-center gap-3 bg-black rounded border border-neutral-800 px-2 py-1"><button onclick="updateQuantity(${i.id},-1)" class="text-neutral-400 hover:text-white">${icons.minus}</button><span class="text-xs font-mono w-4 text-center">${i.quantity}</span><button onclick="updateQuantity(${i.id},1)" class="text-neutral-400 hover:text-white">${icons.plus}</button></div><button onclick="removeFromCart(${i.id})" class="text-neutral-600 hover:text-red-600">${icons.trash}</button></div></div>
   </div>`).join('')}
  </div>
  ${cart.length > 0 ? `<div class="p-5 border-t border-neutral-800 bg-neutral-900"><div class="flex justify-between items-center mb-6"><span class="text-neutral-400 uppercase tracking-widest text-sm">Total a pagar</span><span class="text-2xl font-bold text-amber-500 font-mono">${money(cartTotal())}</span></div><button onclick="startCheckout()" class="w-full py-4 bg-red-800 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2">Proceder al Pago ${icons.right}</button></div>` : ''}
 </div>
</div>`;
}

const inputCls = 'w-full bg-neutral-900 border border-neutral-800 rounded p-3 text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-red-700 font-mono text-sm';
const labelCls = 'text-xs uppercase tracking-widest text-neutral-500 font-bold';

function modalShell(title, subtitle, closeFn, body) {
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
 <div class="modal-card bg-neutral-950 border border-red-900/50 rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
   <div class="modal-card__header bg-gradient-to-r from-red-950 to-black p-6 border-b border-red-900/50 flex justify-between items-center">
   <div><h3 class="text-xl font-serif font-bold text-white uppercase tracking-widest">${title}</h3><p class="text-xs text-amber-500 font-mono mt-1">${subtitle}</p></div>
   <button onclick="${closeFn}" class="text-neutral-400 hover:text-white text-2xl">${icons.close}</button>
  </div>
  <div class="p-6 space-y-6">${body}</div>
 </div></div>`;
}

function authHTML() {
  if (!authModal) return '';
  const reg = authModal === 'register';
  return modalShell(reg ? 'Crear cuenta' : 'Iniciar sesión', reg ? 'Registro de usuarios' : 'Acceso al POS', 'closeAuth()', `
   <div class="space-y-4">
    ${reg ? `<div class="space-y-2"><label class="${labelCls}">Nombre</label><input id="auth-name" type="text" autocomplete="name" class="${inputCls}"></div>` : ''}
    <div class="space-y-2"><label class="${labelCls}">${reg ? 'Correo' : 'Usuario o correo'}</label><input id="auth-email" type="${reg ? 'email' : 'text'}" autocomplete="${reg ? 'email' : 'username'}" placeholder="${reg ? '' : 'Correo o usuario'}" class="${inputCls}"></div>
    <div class="space-y-2"><label class="${labelCls}">Contraseña</label><input id="auth-pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" class="${inputCls}"></div>
    ${reg ? '<p class="text-[11px] text-neutral-600">Las cuentas nuevas tienen acceso de cliente.</p>' : ''}
   </div>
   <button onclick="submitAuth()" class="w-full py-4 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-bold uppercase tracking-widest rounded shadow-lg">${reg ? 'Registrarme' : 'Entrar'}</button>
   <p class="text-center text-xs text-neutral-500">${reg ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} <button onclick="openAuth('${reg ? 'login' : 'register'}')" class="text-amber-500 hover:text-red-500 uppercase tracking-widest">${reg ? 'Iniciar sesión' : 'Registrarme'}</button></p>`);
}

function checkoutHTML() {
  if (!checkout) return '';
  const order = checkout.orderId ? orders.find(o => o.id === checkout.orderId) : null;
  const items = order ? order.items : cart;
  const total = order ? order.total : cartTotal();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return modalShell('Procesar Transacción', order ? `Pedido ${order.id}` : 'Venta de mostrador', 'closeCheckout()', `
   <div class="bg-black/50 p-4 rounded border border-neutral-800 flex justify-between items-center"><span class="text-sm text-neutral-300 uppercase tracking-wider">${count} Artículos</span><span class="text-lg font-mono text-amber-500 font-bold">${money(total)}</span></div>
   ${order && order.error ? `<p class="text-sm text-red-500">${esc(order.error)}</p>` : ''}
   <div class="space-y-3">
    <label class="${labelCls}">Método de pago</label>
    ${methods.map(m => `
    <label class="flex items-center gap-3 p-3 rounded border cursor-pointer ${payMethod === m.id ? 'border-red-700 bg-red-950/20' : 'border-neutral-800 bg-neutral-900'}">
     <input type="radio" name="pm" ${payMethod === m.id ? 'checked' : ''} onchange="payMethod='${m.id}';render()" class="accent-red-700">
     <span class="flex-grow text-sm text-neutral-200">${esc(m.etiqueta)}${m.titular ? `<span class="block text-[11px] text-neutral-500">${esc(m.titular)} · vence ${m.vence}</span>` : ''}</span>
     ${m.tipo === 'tarjeta' ? `<button type="button" onclick="event.preventDefault();deleteCard('${m.id}')" class="text-neutral-600 hover:text-red-600">${icons.trash}</button>` : ''}
    </label>`).join('')}
    ${checkout.addingCard ? `
    <div class="space-y-3 p-4 rounded border border-neutral-800 bg-neutral-900">
     <input id="card-name" type="text" placeholder="Titular" autocomplete="cc-name" class="${inputCls}">
     <input id="card-number" type="text" inputmode="numeric" maxlength="23" placeholder="0000 0000 0000 0000" autocomplete="cc-number" oninput="formatCardNumber(this)" class="${inputCls}">
     <input id="card-exp" type="text" inputmode="numeric" maxlength="5" placeholder="MM/AA" autocomplete="cc-exp" oninput="formatCardExpiry(this)" class="${inputCls}">
     <p class="text-[11px] text-neutral-600">Solo se guarda la marca y los últimos 4 dígitos. Prueba: 4242 4242 4242 4242 (aprueba) · 4000 0000 0000 0002 (rechaza).</p>
     <div class="flex gap-3"><button onclick="saveCard()" class="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold uppercase tracking-widest rounded">Guardar tarjeta</button><button onclick="toggleAddCard(false)" class="px-4 py-2 text-neutral-500 text-xs uppercase tracking-widest">Cancelar</button></div>
    </div>` : `<button onclick="toggleAddCard(true)" class="text-xs text-amber-500 hover:text-red-500 uppercase tracking-widest">+ Agregar tarjeta</button>`}
   </div>
   <div class="flex justify-center"><div class="px-3 py-1 bg-indigo-500/10 rounded flex items-center gap-2 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">${icons.shield} Modo local · el cobro se simula en este navegador</div></div>
   <button onclick="confirmPay()" class="w-full py-4 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-bold uppercase tracking-widest rounded shadow-lg">Pagar ${money(total)}</button>`);
}

function render() {
  document.getElementById('app').innerHTML = `
<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans flex flex-col selection:bg-red-900 selection:text-white">
${navHTML()}
<main class="flex-grow w-full">
${activeTab === 'catalogo' ? catalogHTML() : activeTab === 'pedidos' ? ordersHTML() : activeTab === 'inventario' ? inventoryHTML() : activeTab === 'reportes' ? reportsHTML() : placeholderHTML()}
</main>
${cartHTML()}
${checkoutHTML()}
${authHTML()}
${productEditorHTML()}
${receiptHTML()}
<footer class="app-footer border-t border-neutral-900 bg-black py-8 text-center mt-auto"><div class="text-red-900/30 text-3xl mb-2">${icons.skull}</div><p class="text-neutral-600 text-xs uppercase tracking-widest font-serif">&copy; ${new Date().getFullYear()} Los Iluminados POS. Todos los derechos reservados.</p></footer>
</div>`;
}

(async () => {
  await authService.initialize();
  await refresh();
})();
