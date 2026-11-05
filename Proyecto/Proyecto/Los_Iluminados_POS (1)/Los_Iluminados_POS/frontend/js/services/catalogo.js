// Servicio: Catálogo de Productos (Productos / Categorías / Franquicias)
const catalogService = {
  _read() {
    let products = store.get('products', null);
    if (!Array.isArray(products)) {
      products = PRODUCTS.map(p => ({ ...p, activo: true }));
      store.set('products', products);
    } else {
      let changed = false;
      products = products.map(p => {
        if (typeof p.activo !== 'boolean') { changed = true; return { ...p, activo: true }; }
        return p;
      });
      if (changed) store.set('products', products);
    }
    return products;
  },

  async list({ includeInactive = false } = {}) {
    if (includeInactive) authService.requireAdmin();
    return this._read().filter(p => includeInactive || p.activo !== false).map(p => ({ ...p }));
  },

  async get(id) {
    const p = this._read().find(x => x.id === Number(id));
    return p ? { ...p } : null;
  },

  _validate(input, currentId = null) {
    const name = (input.name || '').trim();
    const categoria = (input.categoria || '').trim();
    const franquicia = (input.franquicia || '').trim();
    const sku = (input.sku || '').trim().toUpperCase();
    const description = (input.description || '').trim();
    const image = (input.image || '').trim() || 'assets/img/hero.jpg';
    const price = Number(input.price);
    if (name.length < 2 || name.length > 100) throw new Error('El nombre debe tener entre 2 y 100 caracteres.');
    if (!Number.isFinite(price) || price <= 0 || price > 10000000) throw new Error('El precio debe ser mayor que cero.');
    if (!categoria || categoria.length > 60) throw new Error('Escribe una categoría válida (máximo 60 caracteres).');
    if (!franquicia || franquicia.length > 60) throw new Error('Escribe una franquicia válida (máximo 60 caracteres).');
    if (!/^[A-Z0-9-]{2,30}$/.test(sku)) throw new Error('El SKU debe usar entre 2 y 30 letras, números o guiones.');
    if (description.length > 500) throw new Error('La descripción no puede superar 500 caracteres.');
    if (image.length > 300 || /^(javascript|data):/i.test(image)) throw new Error('La ruta de imagen no es válida.');
    if (this._read().some(p => p.id !== currentId && p.sku.toLowerCase() === sku.toLowerCase())) {
      throw new Error('Ese SKU ya está asignado a otro producto.');
    }
    return { name, price: round2(price), categoria, franquicia, sku, description, image };
  },

  async create(input) {
    authService.requireAdmin();
    const product = this._validate(input);
    const products = this._read();
    const id = products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const created = { id, ...product, activo: true };
    products.push(created);
    store.set('products', products);
    const stock = store.get('stock', {});
    stock[id] = 0;
    store.set('stock', stock);
    return { ...created };
  },

  async update(id, input) {
    authService.requireAdmin();
    const products = this._read();
    const product = products.find(p => p.id === Number(id));
    if (!product) throw new Error('Producto no encontrado.');
    Object.assign(product, this._validate(input, product.id));
    store.set('products', products);
    return { ...product };
  },

  async setActive(id, active) {
    authService.requireAdmin();
    if (typeof active !== 'boolean') throw new Error('El estado del producto no es válido.');
    const products = this._read();
    const product = products.find(p => p.id === Number(id));
    if (!product) throw new Error('Producto no encontrado.');
    product.activo = active;
    store.set('products', products);
    return { ...product };
  }
};
