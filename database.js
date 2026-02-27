const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_price REAL NOT NULL,
      image TEXT,
      colors TEXT,
      sizes TEXT,
      category TEXT DEFAULT 'tshirt',
      in_stock INTEGER DEFAULT 1,
      featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      user_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      product_image TEXT,
      custom_design TEXT,
      quantity INTEGER DEFAULT 1,
      size TEXT DEFAULT 'M',
      color TEXT DEFAULT 'White',
      price REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      guest_email TEXT,
      guest_name TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'razorpay',
      payment_status TEXT DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      shipping_name TEXT,
      shipping_phone TEXT,
      shipping_address TEXT,
      city TEXT,
      postal_code TEXT,
      items TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      image TEXT NOT NULL,
      category TEXT DEFAULT 'custom',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      razorpay_order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      status TEXT DEFAULT 'created',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed products if empty
  const productCount = db.exec('SELECT COUNT(*) as count FROM products')[0];
  if (productCount && productCount.values[0][0] === 0) {
    const USD_TO_INR = 83;
    const products = [
      ['Classic Cotton Tee', 'Premium quality 100% cotton t-shirt perfect for everyday wear', 24.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', JSON.stringify(['White', 'Black', 'Navy', 'Gray']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Premium Blend Tee', 'Soft and durable poly-cotton blend for lasting comfort', 29.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400', JSON.stringify(['White', 'Black', 'Red', 'Forest']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Athletic Fit Tee', 'Modern slim fit designed for active lifestyle', 34.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400', JSON.stringify(['White', 'Black', 'Navy', 'Burgundy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 0],
      ['V-Neck Classic', 'Elegant v-neck design for a sophisticated look', 27.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1610652492500-ded49ceeb378?w=400', JSON.stringify(['White', 'Black', 'Gray', 'Navy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Long Sleeve Tee', 'Perfect for cooler weather and layering', 39.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400', JSON.stringify(['White', 'Black', 'Navy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 0],
      ['Tank Top', 'Lightweight and breathable for summer vibes', 19.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400', JSON.stringify(['White', 'Black', 'Gray', 'Red']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tank', 1, 1]
    ];

    const stmt = db.prepare('INSERT INTO products (name, description, base_price, image, colors, sizes, category, in_stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    products.forEach(p => stmt.run(p));
    stmt.free();
    console.log('Seeded products');
  }

  saveDatabase();
  console.log('Database initialized successfully');
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Helper functions
function getDb() {
  return db;
}

function runQuery(sql, params = []) {
  // Convert undefined to null for sql.js
  const sanitizedParams = params.map(p => p === undefined ? null : p);
  db.run(sql, sanitizedParams);
  saveDatabase();
}

function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  runQuery,
  getOne,
  getAll
};
