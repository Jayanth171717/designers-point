# Deployment Guide for Designers Point

## Current Setup
- **Database:** SQLite (file-based, data persists)
- **Server:** Node.js + Express
- **Static files:** Served from /public and /views

## To Deploy on Railway/Render

### Option 1: Railway (Recommended)
1. Push your code to GitHub
2. Go to https://railway.app and sign up
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Root Directory:** `.`
6. Add your domain in Railway dashboard → Project → Settings → Domains

### Option 2: Render
1. Push your code to GitHub
2. Go to https://render.com and sign up
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Add custom domain in Settings → Custom Domains

### For SQLite on Cloud Platforms
The current setup uses file-based SQLite which works on most cloud platforms. However, for production:
- **Railway:** Add persistent disk volume for database file
- **Render:** Use Render's managed PostgreSQL database instead (recommended for production)

### Environment Variables to Set
```
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-secure-secret-key
```

### File Structure to Deploy
```
/designers-point
├── server.js
├── database.js
├── package.json
├── database.sqlite (auto-created on first run)
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── uploads/
└── views/
    ├── index.html
    ├── shop.html
    ├── design.html
    ├── cart.html
    ├── checkout.html
    ├── orders.html
    ├── login.html
    ├── register.html
    └── admin.html
```

## Domain Setup
1. Buy domain from GoDaddy/Namecheap/Cloudflare
2. Add CNAME record pointing to your deployment URL
3. Enable HTTPS (automatic on Railway/Render)

## Production Recommendations
1. Use PostgreSQL instead of SQLite for production
2. Enable HTTPS
3. Set secure cookie settings
4. Add rate limiting
5. Set up proper logging
