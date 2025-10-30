# GoogleTrans Integration Setup Guide

## Overview

This project now uses **py-googletrans** as the primary translation service. The integration combines:
- **Node.js Express server** (main app) - Handles Shopify API calls and routing
- **Python serverless function** (Vercel) - Handles translations using googletrans library

## Architecture

```
┌─────────────────┐
│   Shopify App   │
│   (Node.js)     │
└────────┬────────┘
         │
         │ HTTP Request
         ▼
┌─────────────────┐      ┌──────────────────┐
│  server.js      │─────▶│  /api/translate  │
│  Express App    │      │  (Python API)    │
└─────────────────┘      └─────────┬────────┘
                                    │
                                    │ Uses
                                    ▼
                           ┌──────────────────┐
                           │  googletrans     │
                           │  (Python lib)    │
                           └──────────────────┘
```

## Files Added/Modified

1. **`api/translate.py`** - Python serverless function for Vercel
2. **`requirements.txt`** - Python dependencies (googletrans)
3. **`vercel.json`** - Updated to support both Node.js and Python
4. **`server.js`** - Updated to call Python API as primary translator

## How It Works

### Translation Flow

1. When a translation is needed, `server.js` calls `/api/translate`
2. The Python function uses `googletrans` library (more reliable than direct HTTP)
3. Translation is returned to Node.js and then to Shopify

### Benefits of googletrans

- ✅ **More reliable** - Uses official Google Translate web API
- ✅ **Better token handling** - Automatically generates proper tokens
- ✅ **HTTP/2 support** - Faster requests
- ✅ **Auto language detection** - Detects source language automatically
- ✅ **No API keys needed** - Free unlimited usage (uses web interface)

## Deployment to Vercel

### Option 1: Using PyPI Package (Recommended - Easiest)

The `requirements.txt` already includes `googletrans==4.0.2`. Vercel will automatically:
- Install Python dependencies from `requirements.txt`
- Deploy both Node.js and Python functions
- Handle routing automatically

**Steps:**
1. Push your code to GitHub
2. Connect to Vercel
3. Vercel will auto-detect and install dependencies
4. Deploy!

### Option 2: Using Local py-googletrans Source

If you want to use the local `py-googletrans-main` source instead:

1. **Copy googletrans folder:**
   ```bash
   # Copy the entire googletrans folder from py-googletrans-main
   cp -r /path/to/py-googletrans-main/googletrans ./googletrans
   ```

2. **Update `api/translate.py` imports:**
   ```python
   # If using local source, imports will automatically find it
   from googletrans import Translator
   ```

3. **Keep requirements.txt** (still needs httpx dependencies)

## Environment Variables

Set these in Vercel dashboard:

```bash
# Shopify Credentials
SHOPIFY_API_KEY=your-api-key
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_SECRET=your-api-secret

# Translation Service (new)
PRIMARY_TRANSLATION_SERVICE=googletrans  # Options: googletrans, yandex, auto

# Optional: Yandex (as fallback)
YANDEX_API_KEY=your-yandex-key
YANDEX_FOLDER_ID=your-folder-id

# Other settings
SESSION_SECRET=your-session-secret
```

## Testing Locally

### Prerequisites
- Node.js installed
- Python 3.8+ installed
- pip installed

### Steps

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run Node.js server:**
   ```bash
   npm start
   # or
   node server.js
   ```

4. **Test Python API (if needed):**
   ```bash
   # The Python function will be called automatically by Node.js
   # But you can test it directly:
   curl -X POST http://localhost:3000/api/translate \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello", "sourceLanguage": "en", "targetLanguage": "fr"}'
   ```

## Configuration Options

### Primary Translation Service

Set `PRIMARY_TRANSLATION_SERVICE` environment variable:

- **`googletrans`** (default) - Use Python googletrans API
- **`yandex`** - Use Yandex Translate API  
- **`auto`** - Try googletrans first, fallback to Yandex/other services

### Fallback Behavior

The system will:
1. Try Python googletrans API first (if enabled)
2. Fallback to Yandex (if configured)
3. Fallback to other free services (MyMemory, Google HTTP, etc.)

## Troubleshooting

### Python API Not Working

1. **Check Vercel logs** - Look for Python function errors
2. **Verify requirements.txt** - Make sure googletrans is listed
3. **Check import paths** - Ensure googletrans is installed

### Translation Timeouts

- Python functions on Vercel have a 10s timeout (Hobby plan)
- For long texts, the system automatically chunks them
- Consider upgrading to Pro plan for 60s timeout

### Import Errors

If you see `ModuleNotFoundError: No module named 'googletrans'`:

1. **Check requirements.txt** has `googletrans==4.0.2`
2. **Verify Vercel installed Python dependencies** (check build logs)
3. **Try redeploying** - Sometimes dependencies need to be reinstalled

## GitHub Deployment

### Single Repository Setup

Both Node.js and Python code are in **one repository**:

```
your-repo/
├── server.js              # Node.js Express app
├── api/
│   └── translate.py       # Python serverless function
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
├── vercel.json            # Vercel configuration
└── ...
```

### Deploy Steps

1. **Initialize Git (if not already):**
   ```bash
   git init
   git add .
   git commit -m "Add googletrans integration"
   ```

2. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

3. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect both Node.js and Python
   - Add environment variables
   - Deploy!

## Production Tips

1. **Monitor function logs** - Check Vercel dashboard for errors
2. **Set up alerts** - Get notified of translation failures
3. **Cache translations** - Consider caching common translations
4. **Rate limiting** - Google may rate limit, consider adding delays for bulk operations

## Support

For issues with:
- **googletrans library**: Check [py-googletrans GitHub](https://github.com/ssut/py-googletrans)
- **Vercel Python functions**: Check [Vercel Python docs](https://vercel.com/docs/functions/serverless-functions/runtimes/python)
- **Shopify integration**: Check existing README.md

