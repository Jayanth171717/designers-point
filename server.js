require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');

const { initDatabase, runQuery, getOne, getAll } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Email configuration - Gmail SMTP
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT) || 587;
const EMAIL_USER = process.env.EMAIL_USER || 'pavankumar973106@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

// Create email transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'designers-point-secret-key-2024';

// OTP functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveOTP(email, otp, purpose = 'registration') {
  // Delete any existing OTPs for this email
  await runQuery('DELETE FROM email_otp WHERE email = ? AND purpose = ?', [email, purpose]);

  // Insert new OTP (expires in 10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await runQuery(
    'INSERT INTO email_otp (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
    [email, otp, purpose, expiresAt]
  );
}

async function verifyOTP(email, otp, purpose = 'registration') {
  const result = await getOne(
    'SELECT * FROM email_otp WHERE email = ? AND otp = ? AND purpose = ? AND expires_at > NOW()',
    [email, otp, purpose]
  );
  return result !== null;
}

async function deleteOTP(email, purpose = 'registration') {
  await runQuery('DELETE FROM email_otp WHERE email = ? AND purpose = ?', [email, purpose]);
}

async function sendOTPEmail(email, otp) {
  try {
    const info = await transporter.sendMail({
      from: `"Designers Point" <${EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP for Registration - Designers Point',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Designers Point!</h2>
          <p>Your One-Time Password (OTP) for registration is:</p>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    });
    console.log(`OTP sent to ${email}:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending email:', err.message);
    console.error('Full error:', err);
    return false;
  }
}

// Razorpay configuration
// Replace these with your actual Razorpay keys from https://dashboard.razorpay.com
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'your_key_id';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'your_key_secret';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// USD to INR conversion
const USD_TO_INR = 83;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: isProduction, maxAge: 24 * 60 * 60 * 1000 }
}));

// Session middleware
app.use((req, res, next) => {
  if (!req.session.sessionId) {
    req.session.sessionId = uuidv4();
  }
  res.locals.sessionId = req.session.sessionId;
  res.locals.user = req.session.user || null;
  next();
});

// Products API
app.get('/api/products', async (req, res) => {
  try {
    const { category, featured, minPrice, maxPrice } = req.query;
    let sql = 'SELECT * FROM products WHERE in_stock = 1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (featured) {
      sql += ' AND featured = 1';
    }
    if (minPrice) {
      sql += ' AND base_price >= ?';
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      sql += ' AND base_price <= ?';
      params.push(parseFloat(maxPrice));
    }

    const products = await getAll(sql, params);
    // Parse JSON fields
    products.forEach(p => {
      p.colors = JSON.parse(p.colors || '[]');
      p.sizes = JSON.parse(p.sizes || '[]');
    });

    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getOne('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.colors = JSON.parse(product.colors || '[]');
    product.sizes = JSON.parse(product.sizes || '[]');
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, description, base_price, image, colors, sizes, category, featured } = req.body;
    const sql = `INSERT INTO products (name, description, base_price, image, colors, sizes, category, in_stock, featured)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`;
    await runQuery(sql, [
      name,
      description,
      parseFloat(base_price),
      image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
      JSON.stringify(colors || ['White', 'Black', 'Navy', 'Gray']),
      JSON.stringify(sizes || ['S', 'M', 'L', 'XL', 'XXL']),
      category || 'tshirt',
      featured ? 1 : 0
    ]);
    res.json({ message: 'Product created' });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, description, base_price, image, colors, sizes, category, in_stock, featured } = req.body;
    const sql = `UPDATE products SET name=?, description=?, base_price=?, image=?, colors=?, sizes=?, category=?, in_stock=?, featured=? WHERE id=?`;
    await runQuery(sql, [
      name,
      description,
      parseFloat(base_price),
      image,
      JSON.stringify(colors),
      JSON.stringify(sizes),
      category,
      in_stock ? 1 : 0,
      featured ? 1 : 0,
      parseInt(req.params.id)
    ]);
    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM products WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Cart API
app.get('/api/cart', async (req, res) => {
  try {
    const sessionId = req.session.sessionId;
    const userId = req.session.user ? req.session.user.id : null;

    let cart;
    if (userId) {
      cart = await getAll('SELECT * FROM cart_items WHERE user_id = ?', [userId]);
    } else {
      cart = await getAll('SELECT * FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    res.json(cart);
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart/add', async (req, res) => {
  try {
    const { product_id, product_name, product_image, custom_design, quantity, size, color, price } = req.body;
    const sessionId = req.session.sessionId;
    const userId = req.session.user ? req.session.user.id : null;

    // Check for existing item
    let existing;
    const searchParams = userId
      ? [userId, product_id, size, color]
      : [sessionId, product_id, size, color];

    if (userId) {
      existing = await getOne(`SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?`,
        searchParams);
    } else {
      existing = await getOne(`SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND size = ? AND color = ?`,
        searchParams);
    }

    if (existing) {
      await runQuery('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity || 1, existing.id]);
    } else {
      const sql = `INSERT INTO cart_items (session_id, user_id, product_id, product_name, product_image, custom_design, quantity, size, color, price)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertSessionId = userId ? null : sessionId;
      const insertUserId = userId ? userId : null;

      await runQuery(sql, [
        insertSessionId,
        insertUserId,
        product_id,
        product_name || '',
        product_image || '',
        custom_design || null,
        quantity || 1,
        size || 'M',
        color || 'White',
        parseFloat(price) || 0
      ]);
    }

    // Get updated cart
    let cart;
    if (userId) {
      cart = await getAll('SELECT * FROM cart_items WHERE user_id = ?', [userId]);
    } else {
      cart = await getAll('SELECT * FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    io.emit('cart:updated', { cart, userId, sessionId });
    res.json({ success: true, cart });
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

app.put('/api/cart/update/:id', async (req, res) => {
  try {
    const { quantity } = req.body;
    const sessionId = req.session.sessionId;
    const userId = req.session.user ? req.session.user.id : null;

    await runQuery('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, parseInt(req.params.id)]);

    let cart;
    if (userId) {
      cart = await getAll('SELECT * FROM cart_items WHERE user_id = ?', [userId]);
    } else {
      cart = await getAll('SELECT * FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    io.emit('cart:updated', { cart, userId, sessionId });
    res.json({ success: true, cart });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

app.delete('/api/cart/remove/:id', async (req, res) => {
  try {
    const sessionId = req.session.sessionId;
    const userId = req.session.user ? req.session.user.id : null;

    await runQuery('DELETE FROM cart_items WHERE id = ?', [parseInt(req.params.id)]);

    let cart;
    if (userId) {
      cart = await getAll('SELECT * FROM cart_items WHERE user_id = ?', [userId]);
    } else {
      cart = await getAll('SELECT * FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    io.emit('cart:updated', { cart, userId, sessionId });
    res.json({ success: true, cart });
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

// Orders API - Only logged in users can order
app.post('/api/orders', async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: 'Please login to place an order' });
    }

    const { guest_email, guest_name, shipping_name, shipping_phone, shipping_address, city, postal_code, items } = req.body;
    const userId = req.session.user.id;

    const orderNumber = 'DP' + Date.now().toString(36).toUpperCase();
    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const sql = `INSERT INTO orders (order_number, user_id, total_amount, status, payment_method, payment_status, shipping_name, shipping_phone, shipping_address, city, postal_code, items)
                 VALUES (?, ?, ?, 'pending', 'cod', 'pending', ?, ?, ?, ?, ?, ?)`;

    await runQuery(sql, [
      orderNumber,
      userId,
      total_amount,
      shipping_name || req.session.user.name || '',
      shipping_phone || '',
      shipping_address || '',
      city || '',
      postal_code || '',
      JSON.stringify(items)
    ]);

    // Clear cart
    await runQuery('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    io.emit('cart:updated', { cart: [], userId, sessionId: req.session.sessionId });
    io.emit('order:created', { orderNumber, total_amount });

    const order = await getOne('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
    res.json({ success: true, orderNumber, orderId: order?.id });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Please login to view orders' });
    }

    const orders = await getAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
    orders.forEach(order => {
      order.items = JSON.parse(order.items || '[]');
    });

    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:orderNumber', async (req, res) => {
  try {
    const order = await getOne('SELECT * FROM orders WHERE order_number = ?', [req.params.orderNumber]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.items = JSON.parse(order.items || '[]');
    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Auth API
app.post('/api/auth/register/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existing = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if OTP was recently sent (rate limiting)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentOTP = await getOne(
      "SELECT * FROM email_otp WHERE email = ? AND purpose = 'registration' AND created_at > ?",
      [email, oneMinuteAgo]
    );

    if (recentOTP) {
      return res.status(429).json({ error: 'Please wait before requesting another OTP' });
    }

    const otp = generateOTP();
    await saveOTP(email, otp, 'registration');

    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP. Please check email configuration.' });
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/register/verify', async (req, res) => {
  try {
    const { email, password, name, phone, otp } = req.body;

    if (!email || !password || !name || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify OTP
    const isValid = await verifyOTP(email, otp, 'registration');
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const existing = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the first user (make them admin)
    const userCount = await getOne('SELECT COUNT(*) as count FROM users');
    const isAdmin = parseInt(userCount?.count) === 0 ? 1 : 0;

    const sql = `INSERT INTO users (email, password, name, phone, is_admin) VALUES (?, ?, ?, ?, ?)`;
    await runQuery(sql, [email, hashedPassword, name, phone || null, isAdmin]);

    // Delete used OTP
    await deleteOTP(email, 'registration');

    const newUser = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    req.session.user = { id: newUser.id, email: newUser.email, name: newUser.name, phone: newUser.phone, is_admin: newUser.is_admin };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Legacy register endpoint - redirects to OTP flow
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    const existing = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if OTP was recently sent (rate limiting)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentOTP = await getOne(
      "SELECT * FROM email_otp WHERE email = ? AND purpose = 'registration' AND created_at > ?",
      [email, oneMinuteAgo]
    );

    if (recentOTP) {
      return res.status(429).json({ error: 'Please wait before requesting another OTP' });
    }

    const otp = generateOTP();
    await saveOTP(email, otp, 'registration');

    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP. Please check email configuration.' });
    }

    res.json({ success: true, message: 'OTP sent to your email', requiresVerification: true });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Migrate guest cart to user
    if (req.session.sessionId) {
      const guestItems = await getAll('SELECT * FROM cart_items WHERE session_id = ?', [req.session.sessionId]);
      for (const item of guestItems) {
        await runQuery('UPDATE cart_items SET user_id = ?, session_id = NULL WHERE id = ?', [user.id, item.id]);
      }
    }

    req.session.user = { id: user.id, email: user.email, name: user.name, phone: user.phone, is_admin: user.is_admin };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

// Check if email exists
app.get('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existing = await getOne('SELECT id FROM users WHERE email = ?', [email]);
    res.json({ exists: !!existing });
  } catch (err) {
    console.error('Error checking email:', err);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// Admin API
app.get('/api/admin/orders', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const orders = await getAll('SELECT * FROM orders ORDER BY created_at DESC');
    orders.forEach(order => {
      order.items = JSON.parse(order.items || '[]');
    });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/api/admin/orders/:orderNumber/status', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    await runQuery('UPDATE orders SET status = ? WHERE order_number = ?', [status, req.params.orderNumber]);
    io.emit('order:status', { orderNumber: req.params.orderNumber, status });

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// File upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

app.post('/api/designs/upload', upload.single('design'), async (req, res) => {
  try {
    const { name, category } = req.body;
    const image = '/uploads/' + req.file.filename;

    const sql = `INSERT INTO designs (name, image, category) VALUES (?, ?, ?)`;
    await runQuery(sql, [name || 'Custom Design', image, category || 'custom']);

    const design = await getOne('SELECT * FROM designs WHERE image = ?', [image]);
    res.json({ success: true, image, id: design?.id });
  } catch (err) {
    console.error('Error uploading design:', err);
    res.status(500).json({ error: 'Failed to upload design' });
  }
});

app.get('/api/designs', async (req, res) => {
  try {
    const designs = await getAll('SELECT * FROM designs ORDER BY created_at DESC');
    res.json(designs);
  } catch (err) {
    console.error('Error fetching designs:', err);
    res.status(500).json({ error: 'Failed to fetch designs' });
  }
});

// ============ RAZORPAY PAYMENT API ============

// Get Razorpay key for frontend
app.get('/api/payment/key', (req, res) => {
  res.json({ key: RAZORPAY_KEY_ID });
});

// Create Razorpay order
app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: 'order_' + Date.now()
    };

    const order = await razorpay.orders.create(options);

    // Store pending payment
    const sql = `INSERT INTO pending_payments (order_id, razorpay_order_id, amount, currency, status)
                 VALUES (?, ?, ?, ?, 'created')`;
    await runQuery(sql, [order.receipt, order.id, amount, currency]);

    res.json(order);
  } catch (error) {
    console.error('Razorpay error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify payment signature
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update pending payment status
      await runQuery(`UPDATE pending_payments SET status = 'verified' WHERE razorpay_order_id = ?`,
        [razorpay_order_id]);

      res.json({ success: true, verified: true });
    } else {
      await runQuery(`UPDATE pending_payments SET status = 'failed' WHERE razorpay_order_id = ?`,
        [razorpay_order_id]);
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Payment webhook (for successful payments)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const crypto = require('crypto');
  const signature = req.headers['x-razorpay-signature'];
  const secret = RAZORPAY_KEY_SECRET;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.body.toString());
  const generated_signature = hmac.digest('hex');

  if (generated_signature === signature) {
    const event = JSON.parse(req.body);
    console.log('Payment webhook received:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      console.log('Payment captured:', payment.id);
    }

    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ error: 'Invalid signature' });
  }
});

// ============ HTML PAGES ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'shop.html'));
});

app.get('/design', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'design.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'checkout.html'));
});

app.get('/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'orders.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
  });

  socket.on('design:update', (data) => {
    socket.broadcast.emit('design:preview', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Debug endpoint - remove in production
app.get('/api/debug/email-config', (req, res) => {
  res.json({
    EMAIL_HOST: EMAIL_HOST,
    EMAIL_PORT: EMAIL_PORT,
    EMAIL_USER: EMAIL_USER,
    EMAIL_PASS_SET: !!EMAIL_PASS,
    EMAIL_PASS_LENGTH: EMAIL_PASS ? EMAIL_PASS.length : 0
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Designers Point server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
