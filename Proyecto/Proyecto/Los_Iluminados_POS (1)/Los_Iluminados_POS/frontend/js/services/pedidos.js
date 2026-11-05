// Servicio: Gestión de Pedidos (compras locales)
// Estados: pendiente_pago -> pagado | pago_rechazado (reintentable) | cancelado
// Cada cliente solo ve y modifica sus pedidos; el encargado ve todos.
const ordersService = {
  _read() { return store.get('orders', []); },
  _find(id) { return this._read().find(o => o.id === id) || null; },   // uso interno (webhook)
  _canAccess(order, user) { return user.rol === 'admin' || order.userId === user.id; },

  _update(id, patch) {
    const orders = this._read();
    const o = orders.find(x => x.id === id);
    if (!o) throw new Error('Pedido no encontrado.');
    Object.assign(o, patch);
    store.set('orders', orders);
    return o;
  },

  // Crea un pedido desde las líneas del carrito. Los precios se toman siempre del catálogo.
  async create(lines) {
    const user = authService.require();
    if (!Array.isArray(lines) || !lines.length) throw new Error('El carrito está vacío.');
    const items = [];
    for (const l of lines) {
      const p = await catalogService.get(l.id);
      if (!p) throw new Error('Un producto del carrito ya no existe.');
      if (p.activo === false) throw new Error('Un producto del carrito ya no está disponible.');
      if (!isPositiveInt(l.quantity)) throw new Error('Cantidad no válida.');
      items.push({ id: p.id, name: p.name, sku: p.sku, price: p.price, quantity: l.quantity });
    }
    await inventoryService.check(items);
    const seq = store.get('orderSeq', 0) + 1;
    store.set('orderSeq', seq);
    const order = {
      id: 'PED-' + String(seq).padStart(4, '0'), tipo: 'compra', userId: user.id, cliente: user.nombre,
      items, total: round2(items.reduce((s, i) => s + i.price * i.quantity, 0)),
      estado: 'pendiente_pago', creado: new Date().toISOString(), pago: null, error: ''
    };
    store.set('orders', [...this._read(), order]);
    return order;
  },

  async list() {
    const user = authService.require();
    return this._read().filter(o => this._canAccess(o, user)).reverse();
  },

  async salesSummary(from = '', to = '') {
    authService.requireAdmin();
    const validDate = value => !value || (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    );
    if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
      throw new Error('El rango de fechas del reporte no es válido.');
    }
    const paid = this._read().filter(order => {
      if (order.estado !== 'pagado') return false;
      const date = (order.pago && order.pago.pagado || order.creado).slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    });
    const items = new Map();
    paid.forEach(order => order.items.forEach(item => {
      const current = items.get(item.id) || { id: item.id, name: item.name, quantity: 0, sales: 0 };
      current.quantity += item.quantity;
      current.sales = round2(current.sales + item.price * item.quantity);
      items.set(item.id, current);
    }));
    return {
      from, to, count: paid.length,
      total: round2(paid.reduce((sum, order) => sum + order.total, 0)),
      orders: paid,
      bestsellers: [...items.values()].sort((a, b) => b.quantity - a.quantity || b.sales - a.sales)
    };
  },

  async get(id) {
    const user = authService.require();
    const o = this._find(id);
    return o && this._canAccess(o, user) ? o : null;
  },

  async cancel(id) {
    const o = await this.get(id);
    if (!o) throw new Error('Pedido no encontrado.');
    if (o.estado === 'pagado') throw new Error('Un pedido pagado no se puede cancelar.');
    if (o.estado === 'cancelado') throw new Error('El pedido ya estaba cancelado.');
    return this._update(id, { estado: 'cancelado', error: '' });
  }
};
