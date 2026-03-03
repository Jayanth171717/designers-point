const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;

async function initDatabase() {
  const config = {
    host: process.env.PGHOST || 'localhost',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'designers_point',
    port: process.env.PGPORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // Create connection pool directly - assume database already exists
  pool = new Pool(config);
  console.log('PostgreSQL connection pool created');

  // Test connection
  await pool.query('SELECT 1');
  console.log('Database connection verified');

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      is_admin INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      base_price DECIMAL(10,2) NOT NULL,
      image TEXT,
      colors TEXT,
      sizes TEXT,
      category VARCHAR(50) DEFAULT 'tshirt',
      in_stock INT DEFAULT 1,
      featured INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255),
      user_id INT,
      product_id INT,
      product_name TEXT,
      product_image TEXT,
      custom_design TEXT,
      quantity INT DEFAULT 1,
      size VARCHAR(20) DEFAULT 'M',
      color VARCHAR(50) DEFAULT 'White',
      price DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      user_id INT,
      guest_email VARCHAR(255),
      guest_name VARCHAR(255),
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payment_method VARCHAR(20) DEFAULT 'razorpay',
      payment_status VARCHAR(20) DEFAULT 'pending',
      razorpay_order_id VARCHAR(100),
      razorpay_payment_id VARCHAR(100),
      shipping_name VARCHAR(255),
      shipping_phone VARCHAR(50),
      shipping_address TEXT,
      city VARCHAR(100),
      postal_code VARCHAR(20),
      items TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS designs (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      image TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'custom',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(100) NOT NULL,
      razorpay_order_id VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      status VARCHAR(20) DEFAULT 'created',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_otp (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      purpose VARCHAR(20) DEFAULT 'registration',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed products if empty
  const result = await pool.query('SELECT COUNT(*) as count FROM products');
  if (parseInt(result.rows[0].count) === 0) {
    const USD_TO_INR = 83;
    const products = [
      ['Classic Cotton Tee', 'Premium quality 100% cotton t-shirt perfect for everyday wear', 24.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', JSON.stringify(['White', 'Black', 'Navy', 'Gray']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Premium Blend Tee', 'Soft and durable poly-cotton blend for lasting comfort', 29.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400', JSON.stringify(['White', 'Black', 'Red', 'Forest']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Athletic Fit Tee', 'Modern slim fit designed for active lifestyle', 34.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400', JSON.stringify(['White', 'Black', 'Navy', 'Burgundy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 0],
      ['V-Neck Classic', 'Elegant v-neck design for a sophisticated look', 27.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1610652492500-ded49ceeb378?w=400', JSON.stringify(['White', 'Black', 'Gray', 'Navy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 1],
      ['Long Sleeve Tee', 'Perfect for cooler weather and layering', 39.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400', JSON.stringify(['White', 'Black', 'Navy']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tshirt', 1, 0],
      ['Tank Top', 'Lightweight and breathable for summer vibes', 19.99 * USD_TO_INR, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400', JSON.stringify(['White', 'Black', 'Gray', 'Red']), JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']), 'tank', 1, 1]
    ];

    for (const p of products) {
      await pool.query(
        'INSERT INTO products (name, description, base_price, image, colors, sizes, category, in_stock, featured) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        p
      );
    }
    console.log('Seeded products');
  }

  console.log('Database initialized successfully');
  return pool;
}

function getPool() {
  return pool;
}

// Helper functions - converts ? placeholders to $1, $2, etc. for PostgreSQL
function convertParams(sql, params) {
  let paramIndex = 1;
  const newSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  const sanitizedParams = params.map(p => p === undefined ? null : p);
  return { sql: newSql, params: sanitizedParams };
}

async function runQuery(sql, params = []) {
  const { sql: newSql, params: newParams } = convertParams(sql, params);
  const result = await pool.query(newSql, newParams);
  return result.rows;
}

async function getOne(sql, params = []) {
  const { sql: newSql, params: newParams } = convertParams(sql, params);
  const result = await pool.query(newSql, newParams);
  return result.rows[0] || null;
}

async function getAll(sql, params = []) {
  const { sql: newSql, params: newParams } = convertParams(sql, params);
  const result = await pool.query(newSql, newParams);
  return result.rows;
}

// Save database - not needed for PostgreSQL but kept for compatibility
async function saveDatabase() {
  // PostgreSQL handles persistence automatically
}

module.exports = {
  initDatabase,
  getPool,
  saveDatabase,
  runQuery,
  getOne,
  getAll
};
