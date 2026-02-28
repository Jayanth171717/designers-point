# Designers Point - DTF Printing E-Commerce Platform

## 1. Project Overview

**Project Name:** Designers Point
**Type:** Full-stack E-Commerce Web Application
**Core Functionality:** Custom DTF (Direct-to-Film) printing on T-shirts with real-time design customization, cart, checkout, and order management.
**Target Users:** Customers looking for custom printed T-shirts

## 2. Technology Stack

- **Frontend:** HTML5, CSS3 (modern with animations), Vanilla JavaScript
- **Backend:** Node.js with Express.js
- **Database:** SQLite (file-based, no setup required)
- **Real-time:** Socket.io for live updates
- **File Handling:** Multer for image uploads
- **Session:** Express-session with SQLite store

## 3. UI/UX Specification

### Color Palette
- **Primary:** #1a1a2e (Deep Navy)
- **Secondary:** #16213e (Dark Blue)
- **Accent:** #e94560 (Vibrant Red-Pink)
- **Accent Secondary:** #0f3460 (Royal Blue)
- **Success:** #00d9a5 (Mint Green)
- **Warning:** #ffc107 (Amber)
- **Error:** #ff4757 (Coral Red)
- **Light:** #f8f9fa (Off-white)
- **Dark:** #0d0d0d (Near Black)
- **Text Primary:** #ffffff
- **Text Secondary:** #a0a0a0

### Typography
- **Headings:** 'Clash Display', sans-serif (from CDN)
- **Body:** 'Satoshi', sans-serif (from CDN)
- **Sizes:**
  - H1: 4rem (64px)
  - H2: 2.5rem (40px)
  - H3: 1.75rem (28px)
  - Body: 1rem (16px)
  - Small: 0.875rem (14px)

### Layout Structure
- **Max Width:** 1400px centered
- **Responsive Breakpoints:**
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- **Spacing Scale:** 4px, 8px, 16px, 24px, 32px, 48px, 64px, 96px

### Visual Effects
- Glassmorphism cards with backdrop-filter
- Gradient overlays on hero sections
- Smooth hover transitions (0.3s ease)
- Floating animations for decorative elements
- Staggered reveal animations on page load
- Custom cursor effects
- Particle background on hero

## 4. Pages & Components

### 4.1 Header/Navigation
- Logo with animated glow effect
- Navigation links: Home, Shop, Custom Design, About, Contact
- Cart icon with real-time item count badge
- User account dropdown (Login/Register or Profile)
- Mobile hamburger menu with slide-in animation

### 4.2 Home Page
- **Hero Section:**
  - Full viewport height
  - Animated gradient background with floating shapes
  - Main headline: "Your Vision, Our Print"
  - Subheadline: "Premium DTF Printing on Premium Tees"
  - CTA buttons: "Start Designing" and "Browse Designs"
  - Floating T-shirt mockups with parallax effect

- **Features Section:**
  - 4 feature cards in grid
  - Icons: Premium Quality, Fast Delivery, Custom Designs, Eco-Friendly
  - Hover lift effect with shadow

- **How It Works:**
  - 4-step horizontal timeline
  - Steps: Choose Product → Upload Design → Preview → Order

- **Popular Designs:**
  - Carousel of trending designs
  - Real-time popularity indicators

- **Testimonials:**
  - Auto-rotating slider
  - Customer photos and reviews

- **Footer:**
  - Newsletter signup
  - Quick links
  - Social media icons
  - Contact info

### 4.3 Shop Page
- Filter sidebar (color, size, price, style)
- Product grid with infinite scroll
- Product cards with:
  - Image with hover zoom
  - Quick view button
  - Add to cart button
  - Price and title

### 4.4 Custom Design Studio (Key Feature)
- **Canvas Area:**
  - T-shirt preview (front/back toggle)
  - Draggable design placement
  - Resize and rotate controls
  - Real-time preview updates

- **Design Tools:**
  - Upload own image (drag & drop)
  - Text tool with font selection
  - Clipart library
  - Color picker for text

- **Product Options:**
  - T-shirt color selector
  - Size selector (S, M, L, XL, XXL)
  - Quantity selector

- **Price Calculator:**
  - Real-time price update
  - Based on: base price + design complexity + quantity

- **Add to Cart Button:**
  - Real-time cart update notification
  - Socket.io broadcast to header cart

### 4.5 Cart Page
- Item list with thumbnails
- Quantity adjusters
- Remove item button
- Real-time subtotal calculation
- Proceed to checkout button

### 4.6 Checkout Page
- Shipping information form
- Order summary sidebar
- Payment method selection (UI only - no real payment)
- Place order button

### 4.7 Order Confirmation
- Success animation
- Order details
- Estimated delivery date

### 4.8 User Dashboard
- Order history
- Order status tracking (real-time updates)
- Account settings

### 4.9 Admin Panel
- Product management (CRUD)
- Order management
- Design gallery management

## 5. Backend API Specification

### Endpoints

**Products:**
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

**Cart:**
- `GET /api/cart` - Get user cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update/:id` - Update quantity
- `DELETE /api/cart/remove/:id` - Remove item

**Orders:**
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order

**Designs:**
- `POST /api/designs/upload` - Upload custom design
- `GET /api/designs` - List designs

**Auth:**
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Real-time Events (Socket.io)

- `cart:updated` - Broadcast cart changes
- `order:status` - Order status updates
- `design:preview` - Real-time design preview sync

## 6. Database Schema

### Users Table
- id, email, password_hash, name, phone, address, created_at

### Products Table
- id, name, description, base_price, image, colors (JSON), sizes (JSON), category, in_stock, created_at

### Cart Items Table
- id, user_id, product_id, custom_design, quantity, size, color, created_at

### Orders Table
- id, user_id, total_amount, status, shipping_address, created_at

### Order Items Table
- id, order_id, product_id, custom_design, quantity, size, color, price

## 7. Acceptance Criteria

1. ✅ Home page loads with all sections and animations
2. ✅ Shop page displays products with working filters
3. ✅ Custom design studio allows image upload and preview
4. ✅ Cart updates in real-time across all open tabs
5. ✅ Checkout process completes and creates order
6. ✅ User can register, login, and view order history
7. ✅ Admin can add/manage products
8. ✅ All pages are responsive on mobile/tablet
9. ✅ Socket.io connections work for real-time updates
10. ✅ No console errors on page load

## 8. File Structure

```
/designers-point
├── server.js              # Express server entry
├── package.json           # Dependencies
├── database.js            # SQLite setup
├── /public
│   ├── /css
│   │   ├── styles.css     # Main styles
│   │   └── animations.css # Animations
│   ├── /js
│   │   ├── app.js         # Main frontend logic
│   │   ├── cart.js        # Cart functionality
│   │   ├── design-studio.js # Design studio
│   │   └── auth.js        # Authentication
│   ├── /images
│   │   └── (placeholder images)
│   └── /uploads
│       └── (user uploads)
├── /views
│   ├── index.html         # Home page
│   ├── shop.html          # Shop page
│   ├── design.html        # Custom design studio
│   ├── cart.html          # Cart page
│   ├── checkout.html      # Checkout page
│   ├── orders.html        # Orders page
│   ├── login.html         # Login page
│   ├── register.html      # Register page
│   └── admin.html         # Admin panel
└── /routes
    ├── api.js             # API routes
    └── auth.js            # Auth routes
```
