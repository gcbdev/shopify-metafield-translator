# Deploy to Vercel Guide

## 🚀 Quick Vercel Deployment

### **Method 1: Deploy via Vercel CLI (Recommended)**

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy your app:**
   ```bash
   vercel
   ```

4. **Set environment variables:**
   ```bash
   vercel env add SHOPIFY_API_KEY
   # Enter: 816678fd4b1090ece40548e15b569dd5
   
   vercel env add SHOPIFY_API_SECRET
   # Enter: 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
   
   vercel env add SHOPIFY_SCOPES
   # Enter: read_products,write_products,read_product_listings,write_product_listings
   
   vercel env add SESSION_SECRET
   # Enter: your-random-session-secret-here
   
   vercel env add TRANSLATION_API_KEY
   # Enter: your-translation-api-key
   
   vercel env add TRANSLATION_SERVICE
   # Enter: google
   ```

5. **Redeploy with environment variables:**
   ```bash
   vercel --prod
   ```

### **Method 2: Deploy via GitHub Integration**

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/shopify-metafield-translator.git
   git push -u origin main
   ```

2. **Go to [vercel.com](https://vercel.com) and:**
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect it's a Node.js app

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add these environment variables:
     ```
     SHOPIFY_API_KEY = 816678fd4b1090ece40548e15b569dd5
     SHOPIFY_API_SECRET = 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
     SHOPIFY_SCOPES = read_products,write_products,read_product_listings,write_product_listings
     SESSION_SECRET = your-random-session-secret-here
     TRANSLATION_API_KEY = your-translation-api-key
     TRANSLATION_SERVICE = google
     ```

4. **Deploy automatically**

## 🔧 Configure Your Shopify App

Once deployed, you'll get a Vercel URL like: `https://your-app-name.vercel.app`

1. **Go to [partners.shopify.com](https://partners.shopify.com)**
2. **Create a new app or edit existing app**
3. **Set these URLs:**
   - **App URL:** `https://your-app-name.vercel.app`
   - **Allowed redirection URL:** `https://your-app-name.vercel.app/auth/callback`

## 📱 Install in Your Store

Visit: `https://your-app-name.vercel.app/auth?shop=your-store-name.myshopify.com`

## 🛠️ Local Development with Vercel

For local development that matches Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally with Vercel
vercel dev
```

## 🔍 Troubleshooting

### Common Issues:

1. **"Function timeout" errors:**
   - Vercel has a 10-second timeout for hobby plans
   - Consider upgrading to Pro for longer timeouts
   - Optimize your translation calls

2. **Environment variables not working:**
   - Make sure you've added them in Vercel dashboard
   - Redeploy after adding environment variables

3. **CORS issues:**
   - Vercel automatically handles CORS for most cases
   - Check your HOST environment variable

4. **Session issues:**
   - Make sure SESSION_SECRET is set
   - Consider using Vercel KV for session storage in production

## 📊 Monitoring

- **Vercel Analytics:** Built-in performance monitoring
- **Function Logs:** Check Vercel dashboard for errors
- **Real-time Metrics:** Monitor API usage and performance

## 🚀 Production Tips

1. **Use Vercel KV** for session storage:
   ```bash
   vercel kv create
   ```

2. **Set up custom domain** (optional):
   - Add your domain in Vercel dashboard
   - Update Shopify app URLs

3. **Enable Vercel Analytics** for monitoring

4. **Set up webhooks** for real-time updates

## 🔐 Security

- Environment variables are encrypted in Vercel
- HTTPS is automatically enabled
- Edge functions provide global performance
- Built-in DDoS protection

Your app will be live at: `https://your-app-name.vercel.app`
