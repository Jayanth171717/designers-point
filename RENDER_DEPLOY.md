# Render Deployment Guide

## Option 1: Deploy via Render Dashboard (Recommended)

### Step 1: Push to GitHub
```bash
cd "C:\Users\user\Designers-point"
git init
git add .
git commit -m "Ready for production"
git branch -M main
# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/designers-point.git
git push -u origin main
```

### Step 2: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 3: Create Web Service
1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** designers-point
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or paid for better performance)

### Step 4: Add Environment Variables
In Render dashboard, go to **"Environment"** tab and add:
```
NODE_ENV=production
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
SESSION_SECRET=your-secure-random-string
```

### Step 5: Add Custom Domain
1. In Render dashboard, go to your service → **Settings** → **Custom Domains**
2. Add your domain (e.g., yourdomain.com)
3. Update DNS records as shown

---

## Option 2: Deploy via render.yaml (Auto-deploy)

Create `render.yaml` in your project root:

```yaml
services:
  - type: web
    name: designers-point
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
```

Then connect your repo to Render and it will auto-detect the yaml file.

---

## Important Notes for Production

### Database Persistence
The current SQLite file-based database will **reset** on each deployment. For production:

**Option A: Use Render's PostgreSQL (Recommended)**
1. In Render dashboard → Add-ons → PostgreSQL
2. Update server.js to connect to PostgreSQL instead of SQLite

**Option B: Keep SQLite but accept data loss**
- Orders will reset on redeploy
- Users will need to re-register
- Products will reset to defaults

### Payment Setup
To accept real payments:
1. Sign up at https://dashboard.razorpay.com
2. Get API keys from Settings → API Keys
3. Add to Render Environment Variables

### HTTPS
Render provides free SSL automatically. Just add your custom domain!

---

## Quick Deploy Commands

```bash
# Install Render CLI
npm install -g render-cli

# Or deploy from GitHub (easiest)
# Just push to GitHub and Render detects automatically
```
