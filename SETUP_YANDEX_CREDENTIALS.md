# Quick Setup: Add Your Yandex Credentials

## Your Credentials (Already Configured Below)

```
YANDEX_FOLDER_ID=b1gn8gj1pk8hilk34vt1
YANDEX_API_KEY=AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu
PRIMARY_TRANSLATION_SERVICE=auto
```

## Local Development Setup

Create a `.env` file in your project root (if you don't have one):

```env
# Your existing Shopify credentials
SHOPIFY_API_KEY=816678fd4b1090ece40548e15b569dd5
SHOPIFY_API_SECRET=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
SHOPIFY_SCOPES=read_products,write_products,read_product_listings,write_product_listings
HOST=https://your-app-domain.com
PORT=3000
SESSION_SECRET=your-session-secret-key-here

# Yandex Translate API (FREE - 10M chars/day)
YANDEX_API_KEY=AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu
YANDEX_FOLDER_ID=b1gn8gj1pk8hilk34vt1
PRIMARY_TRANSLATION_SERVICE=auto
```

**Important**: Make sure `.env` is in your `.gitignore` to keep your API keys secure!

## Vercel Deployment Setup

### Option 1: Via Vercel Dashboard

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

   - **Name**: `YANDEX_API_KEY`
     **Value**: `AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu`
     **Environment**: Production, Preview, Development (check all)

   - **Name**: `YANDEX_FOLDER_ID`
     **Value**: `b1gn8gj1pk8hilk34vt1`
     **Environment**: Production, Preview, Development (check all)

   - **Name**: `PRIMARY_TRANSLATION_SERVICE`
     **Value**: `auto`
     **Environment**: Production, Preview, Development (check all)

5. **Redeploy** your application for changes to take effect

### Option 2: Via Vercel CLI

```bash
# Add Yandex API Key
vercel env add YANDEX_API_KEY
# When prompted, paste: AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu
# Select: Production, Preview, Development

# Add Yandex Folder ID
vercel env add YANDEX_FOLDER_ID
# When prompted, paste: b1gn8gj1pk8hilk34vt1
# Select: Production, Preview, Development

# Set primary service
vercel env add PRIMARY_TRANSLATION_SERVICE
# When prompted, enter: auto
# Select: Production, Preview, Development

# Redeploy
vercel --prod
```

## Verify It's Working

After setting up the credentials:

1. **Restart your server** (if running locally)
2. **Test a translation** - Try translating a product metafield
3. **Check console logs** - You should see:
   ```
   🌐 Trying Yandex Translate (free, 10M chars/day)...
   ✅ Yandex Translate: XX → XX chars
   ```

## Troubleshooting

### Not seeing Yandex in logs?

- Check environment variables are set correctly (no extra spaces)
- Ensure `PRIMARY_TRANSLATION_SERVICE=auto` (not set to something else)
- Restart your server after adding env vars
- For Vercel: Make sure you redeployed after adding variables

### Getting authentication errors?

- Verify API key: `AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu`
- Verify Folder ID: `b1gn8gj1pk8hilk34vt1`
- Check Yandex Cloud console to ensure service account has `ai.translate.user` role

## Security Note

⚠️ **Never commit API keys to Git!** Always use environment variables.

