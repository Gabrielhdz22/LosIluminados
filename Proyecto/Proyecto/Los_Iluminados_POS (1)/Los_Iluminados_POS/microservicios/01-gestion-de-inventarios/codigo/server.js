const express = require('express');
const Database = require('better-sqlite3');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT) || 3000;
const databaseDirectory = path.join(__dirname, 'data');
const fs = require('node:fs');

fs.mkdirSync(databaseDirectory, { recursive: true });
const db = new Database(path.join(databaseDirectory, 'inventory.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    min_stock INTEGER NOT NULL CHECK (min_stock >= 0),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('compra', 'venta')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

if (db.prepare('SELECT COUNT(*) AS count FROM products').get().count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, stock, min_stock, updated_at)
    VALUES (@id, @name, @stock, @min, @updated)
  `);
  const seedProducts = [
    { id: 'P001', name: 'Laptop Lenovo', stock: 15, min: 5 },
    { id: 'P002', name: 'Mouse inalámbrico', stock: 28, min: 10 },
    { id: 'P003', name: 'Teclado mecánico', stock: 8, min: 8 },
    { id: 'P004', name: 'Monitor 24 pulgadas', stock: 12, min: 4 },
    { id: 'P005', name: 'Audífonos Bluetooth', stock: 4, min: 6 }
  ];
  const seed = db.transaction(() => {
    const updated = new Date().toISOString();
    for (const product of seedProducts) insertProduct.run({ ...product, updated });
  });
  seed();
}

app.use(express.json());

app.get('/', (request, response) => {
  response.sendFile(path.join(__dirname, 'servicio_15_gestion_inventario.html'));
});

app.get('/api/products', (request, response) => {
  const products = db.prepare(`
    SELECT id, name, stock, min_stock AS min, updated_at AS updated
    FROM products ORDER BY id
  `).all();
  response.json(products);
});

app.get('/api/movements', (request, response) => {
  const movements = db.prepare(`
    SELECT id, product_name AS product, type, quantity AS qty,
      stock_after AS result, created_at AS date
    FROM movements ORDER BY id DESC LIMIT 200
  `).all();
  response.json(movements);
});

app.post('/api/products', (request, response) => {
  const { id, name, stock, min } = request.body;
  const normalizedId = typeof id === 'string' ? id.trim().toUpperCase() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedId || !normalizedName || !Number.isSafeInteger(stock) || stock < 0 ||
      !Number.isSafeInteger(min) || min < 0) {
    return response.status(400).json({ error: 'Completa correctamente los datos del producto.' });
  }

  try {
    const updated = new Date().toISOString();
    db.prepare(`
      INSERT INTO products (id, name, stock, min_stock, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalizedId, normalizedName, stock, min, updated);
    response.status(201).json({ id: normalizedId, name: normalizedName, stock, min, updated });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return response.status(409).json({ error: 'Ese ID de producto ya existe.' });
    }
    throw error;
  }
});

app.delete('/api/products/:id', (request, response) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(request.params.id);
  if (result.changes === 0) return response.status(404).json({ error: 'Producto no encontrado.' });
  response.status(204).end();
});

app.post('/api/movements', (request, response) => {
  const { productId, type, quantity } = request.body;
  if (!['compra', 'venta'].includes(type) || !Number.isSafeInteger(quantity) || quantity < 1) {
    return response.status(400).json({ error: 'El tipo de operación o la cantidad no son válidos.' });
  }

  const createMovement = db.transaction(() => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      const error = new Error('Producto no encontrado.');
      error.status = 404;
      throw error;
    }
    if (type === 'venta' && quantity > product.stock) {
      const error = new Error(`Venta rechazada: solo hay ${product.stock} unidades disponibles.`);
      error.status = 409;
      throw error;
    }

    const stock = product.stock + (type === 'compra' ? quantity : -quantity);
    const updated = new Date().toISOString();
    db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?')
      .run(stock, updated, product.id);
    const result = db.prepare(`
      INSERT INTO movements (product_id, product_name, type, quantity, stock_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(product.id, product.name, type, quantity, stock, updated);

    return {
      id: Number(result.lastInsertRowid),
      product: product.name,
      type,
      qty: quantity,
      result: stock,
      date: updated,
      productId: product.id,
      previousStock: product.stock
    };
  });

  try {
    response.status(201).json(createMovement());
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message });
    throw error;
  }
});

app.get('/api/summary', (request, response) => {
  response.json(db.prepare(`
    SELECT COUNT(*) AS totalProducts,
      COALESCE(SUM(stock), 0) AS totalUnits,
      SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) AS lowProducts
    FROM products
  `).get());
});

app.use((error, request, response, next) => {
  console.error(error);
  if (response.headersSent) return next(error);
  response.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
});

app.listen(port, () => {
  console.log(`Gestión de Inventario disponible en http://localhost:${port}`);
});