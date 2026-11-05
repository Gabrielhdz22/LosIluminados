// Servicio: Gestión de Inventarios
const inventoryService = {
  STOCK_INICIAL: 10,

  _read() {
    const s = store.get('stock', {});
    let changed = false;
    catalogService._read().forEach(p => { if (!(p.id in s)) { s[p.id] = this.STOCK_INICIAL; changed = true; } });
    if (changed) store.set('stock', s);
    return s;
  },

  async all() { return { ...this._read() }; },

  async check(lines) {
    const s = this._read();
    for (const l of lines) {
      if ((s[l.id] || 0) < l.quantity) throw new Error(`Stock insuficiente de ${l.name} (disponible: ${s[l.id] || 0}).`);
    }
  },

  // Se llama solo después de confirmar el pago de una venta.
  async discount(lines) {
    await this.check(lines);
    const s = this._read();
    lines.forEach(l => { s[l.id] -= l.quantity; });
    store.set('stock', s);
  },

  async restock(id, qty) {
    authService.requireAdmin();
    if (!await catalogService.get(id)) throw new Error('Producto no encontrado.');
    if (!isPositiveInt(qty) || qty > 1000) throw new Error('La cantidad debe ser un entero entre 1 y 1000.');
    const s = this._read();
    s[id] += qty;
    store.set('stock', s);
  },

  async setQuantity(id, qty) {
    authService.requireAdmin();
    if (!await catalogService.get(id)) throw new Error('Producto no encontrado.');
    if (!Number.isInteger(qty) || qty < 0 || qty > 1000000) throw new Error('La existencia debe ser un entero entre 0 y 1000000.');
    const s = this._read();
    s[id] = qty;
    store.set('stock', s);
  }
};
