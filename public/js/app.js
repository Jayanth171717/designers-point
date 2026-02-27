// ========================================
// DESIGNERS POINT - MAIN APP.JS
// ========================================

// Global state
const state = {
  user: null,
  cart: [],
  products: [],
  socket: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Initialize socket
  initSocket();

  // Check auth status
  await checkAuth();

  // Load cart
  await loadCart();

  // Update UI
  updateAuthUI();
  updateCartUI();

  // Initialize mobile menu
  initMobileMenu();

  // Initialize header scroll
  initHeaderScroll();

  // Initialize current page
  if (typeof initPage === 'function') {
    initPage();
  }
}

// Socket.io initialization
function initSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    console.log('Connected to server');
    if (state.user) {
      state.socket.emit('join-session', `user_${state.user.id}`);
    } else {
      state.socket.emit('join-session', getSessionId());
    }
  });

  state.socket.on('cart:updated', (data) => {
    if (data.sessionId === getSessionId() || (state.user && data.userId === state.user.id)) {
      state.cart = data.cart;
      updateCartUI();
    }
  });

  state.socket.on('order:status', (data) => {
    showToast(`Order ${data.orderNumber} status: ${data.status}`, 'success');
    if (typeof refreshOrders === 'function') {
      refreshOrders();
    }
  });
}

function getSessionId() {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Auth functions
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      state.user = data.user;
    }
  } catch (err) {
    console.error('Auth check failed:', err);
  }
}

async function login(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    state.user = data.user;
    updateAuthUI();
    showToast('Welcome back!', 'success');
    return true;
  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
}

async function register(name, email, password) {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    state.user = data.user;
    updateAuthUI();
    showToast('Account created successfully!', 'success');
    return true;
  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    state.user = null;
    state.cart = [];
    updateAuthUI();
    updateCartUI();
    showToast('Logged out successfully', 'success');
    window.location.href = '/';
  } catch (err) {
    showToast('Logout failed', 'error');
  }
}

function updateAuthUI() {
  const authContainer = document.getElementById('auth-container');
  if (!authContainer) return;

  if (state.user) {
    authContainer.innerHTML = `
      <div class="user-menu">
        <button class="user-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span>${state.user.name}</span>
        </button>
        <div class="user-dropdown">
          <a href="/orders">My Orders</a>
          ${state.user.is_admin ? '<a href="/admin">Admin Panel</a>' : ''}
          <button onclick="logout()">Logout</button>
        </div>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <a href="/login" class="btn btn-secondary btn-sm">Login</a>
      <a href="/register" class="btn btn-primary btn-sm">Register</a>
    `;
  }
}

// Cart functions
async function loadCart() {
  try {
    const res = await fetch('/api/cart');
    state.cart = await res.json();
  } catch (err) {
    console.error('Failed to load cart:', err);
  }
}

async function addToCart(product, options = {}) {
  const item = {
    product_id: product.id,
    product_name: product.name,
    product_image: product.image,
    quantity: options.quantity || 1,
    size: options.size || 'M',
    color: options.color || 'White',
    price: product.base_price,
    custom_design: options.customDesign || null
  };

  try {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    const data = await res.json();
    if (res.ok) {
      state.cart = data.cart;
      updateCartUI();
      showToast('Added to cart!', 'success');
      return true;
    }
  } catch (err) {
    showToast('Failed to add to cart', 'error');
  }
  return false;
}

async function updateCartItem(id, quantity) {
  try {
    const res = await fetch(`/api/cart/update/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    const data = await res.json();
    if (res.ok) {
      state.cart = data.cart;
      updateCartUI();
    }
  } catch (err) {
    showToast('Failed to update cart', 'error');
  }
}

async function removeCartItem(id) {
  try {
    const res = await fetch(`/api/cart/remove/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      state.cart = data.cart;
      updateCartUI();
      showToast('Item removed from cart', 'success');
    }
  } catch (err) {
    showToast('Failed to remove item', 'error');
  }
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartUI() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = count;
    cartCount.style.display = count > 0 ? 'flex' : 'none';
  }

  // Update cart page if on cart page
  if (typeof renderCartItems === 'function') {
    renderCartItems();
  }
}

// Products
async function loadProducts(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/products?${params}`);
    state.products = await res.json();
    return state.products;
  } catch (err) {
    console.error('Failed to load products:', err);
    return [];
  }
}

// Toast notifications
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${type === 'success'
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
        : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
      }
    </svg>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Mobile menu
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-overlay');
  const closeBtn = document.getElementById('mobile-close-btn');

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      mobileNav.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    const closeMenu = () => {
      mobileNav.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
  }
}

// Header scroll effect
function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// Format price (Indian Rupees)
function formatPrice(price) {
  return `₹${(parseFloat(price) * 83).toFixed(2)}`; // Approximate USD to INR conversion
}

// Format price in INR directly
function formatPriceINR(price) {
  return `₹${parseFloat(price).toFixed(2)}`;
}

// Save design to localStorage for preview
function saveDesignPreview(designData) {
  localStorage.setItem('designPreview', JSON.stringify(designData));
}

function getDesignPreview() {
  const data = localStorage.getItem('designPreview');
  return data ? JSON.parse(data) : null;
}

function clearDesignPreview() {
  localStorage.removeItem('designPreview');
}

// Export functions to global scope
window.state = state;
window.login = login;
window.register = register;
window.logout = logout;
window.loadCart = loadCart;
window.addToCart = addToCart;
window.updateCartItem = updateCartItem;
window.removeCartItem = removeCartItem;
window.getCartTotal = getCartTotal;
window.loadProducts = loadProducts;
window.showToast = showToast;
window.formatPrice = formatPrice;
window.saveDesignPreview = saveDesignPreview;
window.getDesignPreview = getDesignPreview;
window.clearDesignPreview = clearDesignPreview;
