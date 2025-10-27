# Shopify Metafield Translator

Simple Shopify app to view French translations from specification metafields.

## Features

- View original specification content
- View French translations automatically
- Scan and refresh all products
- Simplified UI with one-click navigation

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables in Vercel:**
   ```
   SHOPIFY_ACCESS_TOKEN = your_access_token
   SHOPIFY_API_KEY = your_api_key  
   SHOPIFY_API_SECRET = your_api_secret
   ```

3. **Deploy to Vercel:**
   - Push to GitHub
   - Import project in Vercel
   - Add environment variables
   - Deploy!

## Usage

Visit: `https://your-app.vercel.app?shop=your-store.myshopify.com`

The app will automatically:
- Load all products with specification metafields
- Display original and French content side-by-side
- Allow you to refresh/scan all products

## Changes Made

✅ Removed all extra buttons  
✅ Simplified UI to show only "Translated to French" field  
✅ Added "Refresh/Scan All Products" button  
✅ Fixed serverless compatibility for Vercel  
✅ Removed problematic middleware (sessions, helmet, etc.)  

Ready to deploy! 🚀
