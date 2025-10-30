# Yandex Translate API Setup Guide

## Overview

Yandex Translate API offers a generous **free tier: 10,000,000 characters per day** with no credit card required.

## Step-by-Step Setup

### Step 1: Create Yandex Cloud Account

1. **Visit Yandex Cloud**: Go to [https://yandex.cloud/en/](https://yandex.cloud/en/)
2. **Sign Up**: Click "Sign up" or "Get started"
   - You can sign up with your email, Google account, or Yandex account
   - **No credit card required at this stage**

### Step 2: Create a Folder (Organization Unit)

1. **Log into Yandex Cloud Console**: [https://console.cloud.yandex.com/](https://console.cloud.yandex.com/)
2. **Navigate to Folders**: Click on "Folders" in the left sidebar, or go directly to the folder management
3. **Create New Folder**: 
   - Click "Create folder"
   - Enter a name (e.g., "translation-api" or "shopify-app")
   - Click "Create"
4. **Copy Folder ID**: 
   - After creation, you'll see your folder ID
   - It looks like: `b1gxxxxxxxxxxxxxxxxxxxxx`
   - **Save this ID** - you'll need it for the `YANDEX_FOLDER_ID` environment variable

### Step 3: Enable Translate API

1. **Go to Marketplace**: In the Yandex Cloud console, navigate to "Marketplace"
2. **Search for Translate**: Search for "Yandex Translate API" or "Translate"
3. **Enable Service**: 
   - Click on the Translate API service
   - Click "Use" or "Enable"
   - It should automatically activate the free tier (no payment method needed initially)

### Step 4: Create a Service Account

1. **Go to IAM**: Navigate to "IAM & Service Accounts" in the left sidebar
2. **Select Your Folder**: Make sure you're in the folder you created in Step 2
3. **Create Service Account**:
   - Click "Create service account"
   - Enter a name (e.g., "translate-api-user")
   - (Optional) Add description
   - Click "Create"

### Step 5: Assign Permissions to Service Account

1. **Edit Service Account**: Click on the service account you just created
2. **Go to "Access bindings" tab**
3. **Assign Role**:
   - Click "Assign roles"
   - In the "Roles" dropdown, select: `ai.translate.user` or `ai.translate.executor`
   - Click "Save"
   - This grants permission to use the Translate API

### Step 6: Create API Key

1. **Go to API Keys**: While viewing your service account, go to the "API keys" tab
2. **Create API Key**:
   - Click "Create API key"
   - Enter a description (e.g., "Shopify Translator App")
   - Click "Create"
3. **Copy API Key**: 
   - **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
   - It looks like: `AQVNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Save this securely** - you'll need it for the `YANDEX_API_KEY` environment variable

### Step 7: Add Credentials to Your Project

#### For Local Development (`.env` file):

```env
YANDEX_API_KEY=AQVNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YANDEX_FOLDER_ID=b1gxxxxxxxxxxxxxxxxxxxxx
PRIMARY_TRANSLATION_SERVICE=auto
```

#### For Vercel Deployment:

**Option 1: Via Vercel Dashboard**
1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add these variables:
   - Name: `YANDEX_API_KEY`, Value: `AQVNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Name: `YANDEX_FOLDER_ID`, Value: `b1gxxxxxxxxxxxxxxxxxxxxx`
   - Name: `PRIMARY_TRANSLATION_SERVICE`, Value: `auto`

**Option 2: Via Vercel CLI**
```bash
vercel env add YANDEX_API_KEY
# Paste your API key when prompted

vercel env add YANDEX_FOLDER_ID
# Paste your folder ID when prompted

vercel env add PRIMARY_TRANSLATION_SERVICE
# Enter: auto
```

### Step 8: Verify Setup

1. **Restart your server** (if running locally)
2. **Test translation**: Try translating a product metafield
3. **Check logs**: Look for `✅ Yandex Translate:` messages in your console

## Free Tier Limits

- **10,000,000 characters per day** (10 million)
- **No credit card required** for free tier
- Resets daily at midnight UTC
- Perfect for most Shopify stores

## Troubleshooting

### "403 Forbidden" Error

**Possible causes:**
1. API key is incorrect - double-check the key you copied
2. Service account doesn't have the right permissions - ensure `ai.translate.user` role is assigned
3. Folder ID is incorrect - verify you're using the correct folder ID

**Solution:**
- Re-check Steps 4-6 above
- Ensure the API key is associated with the correct service account
- Verify the folder ID matches the folder where you created the service account

### "429 Too Many Requests" Error

**Cause:** You've exceeded the 10M characters/day limit

**Solution:**
- Wait until the next day (resets at midnight UTC)
- Or use fallback services (MyMemory/Google/LibreTranslate will automatically be used)

### "401 Unauthorized" Error

**Cause:** Invalid API key or authentication issue

**Solution:**
- Verify your API key is correct (no extra spaces)
- Ensure the API key format: `Api-Key YOUR_KEY` (the code handles this automatically)

### Translation Not Working

**Check:**
1. Environment variables are set correctly
2. `PRIMARY_TRANSLATION_SERVICE=auto` (or `PRIMARY_TRANSLATION_SERVICE=yandex`)
3. Both `YANDEX_API_KEY` and `YANDEX_FOLDER_ID` are configured
4. Server logs show Yandex is being attempted

## Configuration Options

### Service Priority

Set `PRIMARY_TRANSLATION_SERVICE` to control which service is tried first:

- `auto` - Uses Yandex if API key provided, otherwise uses free services (MyMemory/Google/LibreTranslate)
- `yandex` - Always try Yandex first (requires API key)
- `google` - Always try Google Translate first
- `mymemory` - Always try MyMemory first

### Example Configurations

**Use Yandex as primary (recommended):**
```env
YANDEX_API_KEY=your-key-here
YANDEX_FOLDER_ID=your-folder-id
PRIMARY_TRANSLATION_SERVICE=auto
```

**Force Yandex only:**
```env
YANDEX_API_KEY=your-key-here
YANDEX_FOLDER_ID=your-folder-id
PRIMARY_TRANSLATION_SERVICE=yandex
```

**Use free services only (no Yandex):**
```env
# Don't set YANDEX_API_KEY
PRIMARY_TRANSLATION_SERVICE=auto
```

## Comparison with Other Services

| Service | Free Limit | Credit Card Required | Speed | Accuracy |
|---------|-----------|---------------------|-------|----------|
| **Yandex** | 10M chars/day | ❌ No | ⚡ Fast | ⭐⭐⭐⭐ |
| MyMemory | Unlimited* | ❌ No | ⚡ Medium | ⭐⭐⭐ |
| Google (unofficial) | ~500K/month | ❌ No | ⚡ Medium | ⭐⭐⭐⭐ |
| LibreTranslate | Unlimited* | ❌ No | 🐌 Slow | ⭐⭐ |

*MyMemory and LibreTranslate have rate limits but no hard character limits

## Additional Resources

- **Yandex Cloud Documentation**: [https://cloud.yandex.com/en/docs/translate/](https://cloud.yandex.com/en/docs/translate/)
- **Translate API Reference**: [https://cloud.yandex.com/en/docs/translate/api-ref/](https://cloud.yandex.com/en/docs/translate/api-ref/)
- **Yandex Cloud Console**: [https://console.cloud.yandex.com/](https://console.cloud.yandex.com/)

## Security Best Practices

1. **Never commit API keys to Git**: Always use environment variables
2. **Rotate keys periodically**: Generate new API keys every 6-12 months
3. **Use service accounts**: Don't use your personal account credentials
4. **Limit permissions**: Only grant `ai.translate.user` role (minimum required)
5. **Monitor usage**: Check Yandex Cloud console for unexpected usage

## Support

If you encounter issues not covered here:

1. **Check Yandex Cloud Console**: Monitor API usage and errors
2. **Review server logs**: Look for detailed error messages
3. **Test API directly**: Use curl or Postman to test the API key independently
4. **Yandex Support**: Contact Yandex Cloud support if API issues persist

---

**Ready to use!** Once configured, Yandex Translate will automatically be used as the primary translation service, with MyMemory, Google Translate, and LibreTranslate as fallbacks.

