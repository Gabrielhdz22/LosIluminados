// Servicio: Carrito de Compras (persistente). Guarda solo id y cantidad;
// los precios se consultan siempre al catálogo y las cantidades se ajustan al stock.
const cartService = {
  _key() {
    const user = authService.current();
    return user ? `cart:${user.id}` : 'cart';
  },
  _read() { return store.get(this._key(), []); },

  async claimGuestCart() {
    const guest = store.get('cart', []);
    if (!Array.isArray(guest) || guest.length === 0) return false;

    const stock = await inventoryService.all();
    const saved = await this.priced();
    const merged = saved.map(line => ({ id: line.id, quantity: line.quantity }));
    let adjusted = false;

    for (const line of guest) {
      if (!line || typeof line !== 'object') { adjusted = true; continue; }
      const product = await catalogService.get(line.id);
      if (!product || product.activo === false || !isPositiveInt(line.quantity)) { adjusted = true; continue; }
      const existing = merged.find(item => item.id === line.id);
      const requested = (existing ? existing.quantity : 0) + line.quantity;
      const quantity = Math.min(requested, stock[line.id] || 0);
      if (quantity !== requested) adjusted = true;
      if (quantity < 1) continue;
      if (existing) existing.quantity = quantity;
      else merged.push({ id: line.id, quantity });
    }

    store.set(this._key(), merged);
    store.del('cart');
    return adjusted;
  },

  async priced() {
    const stock = await inventoryService.all();
    const saved = this._read(), lines = [], kept = [];
    for (const l of saved) {
      const p = await catalogService.get(l.id);
      const quantity = Math.min(l.quantity, stock[l.id] || 0);
      if (!p || p.activo === false || quantity < 1) continue;
      lines.push({ ...p, quantity });
      kept.push({ id: l.id, quantity });
    }
    if (kept.length !== saved.length || kept.some((k, i) => k.quantity !== saved[i].quantity)) store.set(this._key(), kept);
    return lines;
  },

  total(lines) { return round2(lines.reduce((s, i) => s + i.price * i.quantity, 0)); },

  async add(id) { return this.change(id, 1); },

  async change(id, delta) {
    if (!Number.isInteger(delta) || delta === 0) throw new Error('El cambio de cantidad debe ser un entero distinto de cero.');
    const p = await catalogService.get(id);
    if (!p || p.activo === false) throw new Error('Este producto ya no está disponible.');
    const stock = await inventoryService.all();
    let cart = this._read();
    const e = cart.find(x => x.id === id);
    const q = (e ? e.quantity : 0) + delta;
    if (q > (stock[id] || 0)) throw new Error('No hay más existencias de este artículo.');
    if (q <= 0) cart = cart.filter(x => x.id !== id);
    else if (e) e.quantity = q;
    else cart.push({ id, quantity: q });
    store.set(this._key(), cart);
  },

  async remove(id) { store.set(this._key(), this._read().filter(x => x.id !== id)); },
  async clear() { store.set(this._key(), []); }
};
