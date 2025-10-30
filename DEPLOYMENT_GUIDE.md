# 🚀 Complete Deployment Guide: Shopify App with GoogleTrans

## Quick Answer to Your Question

**Yes, you upload everything to ONE GitHub repository and Vercel will handle both Node.js and Python automatically!**

No need to upload separately - everything goes in **one repo** → **one Vercel deployment**.

## 📦 What Was Added

1. ✅ **`api/translate.py`** - Python serverless function using googletrans
2. ✅ **`requirements.txt`** - Python dependencies  
3. ✅ **Updated `server.js`** - Now calls Python API for translations
4. ✅ **Updated `vercel.json`** - Supports both Node.js and Python

## 🎯 One-Time Setup Steps

### Step 1: Copy googletrans Files (Optional - if using local source)

If you want to use your local `py-googletrans-main` source instead of PyPI:

```bash
# Copy the googletrans folder manually:
# Windows: Copy the entire "googletrans" folder from:
#   c:\Users\GoCrayonsBiñan\Desktop\py-googletrans-main\googletrans
# To:
#   c:\Users\GoCrayonsBiñan\Desktop\shopify-metafield-translator-...\googletrans
```

**Or just use PyPI version** (already configured in `requirements.txt`) - **easier option!**

### Step 2: Push Everything to GitHub

```bash
# In your shopify-metafield-translator folder:
git init  # if not already initialized
git add .
git commit -m "Add googletrans integration"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Step 3: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)** and login
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Vercel will auto-detect:**
   - ✅ Node.js (from `package.json`)
   - ✅ Python (from `api/translate.py` and `requirements.txt`)
   - ✅ Both build automatically!

5. **Add Environment Variables** in Vercel dashboard:
   ```
   SHOPIFY_API_KEY=your-key
   SHOPIFY_ACCESS_TOKEN=your-token
   SHOPIFY_API_SECRET=your-secret
   PRIMARY_TRANSLATION_SERVICE=googletrans
   SESSION_SECRET=random-secret
   
   # Optional (for fallback):
   YANDEX_API_KEY=your-yandex-key
   YANDEX_FOLDER_ID=your-folder-id
   ```

6. **Click Deploy!** 🎉

## 📁 Project Structure (After Integration)

```
your-repo/
├── server.js              # Node.js Express app (main)
├── api/
│   └── translate.py       # Python serverless function ✨ NEW
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies ✨ NEW
├── vercel.json            # Vercel config (updated)
├── googletrans/           # (Optional) Local source
│   ├── __init__.py
│   ├── client.py
│   └── ...
├── translation-service.js
├── public/
│   ├── index.html
│   └── install.html
└── ...
```

## ✅ How It Works

1. **Shopify app runs** → Node.js Express server (`server.js`)
2. **Translation needed** → Calls `/api/translate` 
3. **Python function** (`api/translate.py`) uses googletrans
4. **Translation returned** → Back to Node.js → Shopify

## 🔧 Configuration

### Primary Translation Service

Set `PRIMARY_TRANSLATION_SERVICE` in Vercel:

- **`googletrans`** (default) - Use Python googletrans API ⭐ Recommended
- **`yandex`** - Use Yandex Translate API
- **`auto`** - Try googletrans first, then fallback

### Fallback Chain

1. **Python googletrans** (if enabled)
2. **Yandex** (if API key configured)
3. **Other free services** (MyMemory, Google HTTP, etc.)

## 🧪 Testing

### Local Testing (Optional)

1. **Install Node.js deps:**
   ```bash
   npm install
   ```

2. **Install Python deps:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run server:**
   ```bash
   npm start
   ```

4. **Test translation:**
   - Use the Shopify app UI
   - Or test API directly: `curl -X POST http://localhost:3000/api/translate -H "Content-Type: application/json" -d '{"text":"Hello","sourceLanguage":"en","targetLanguage":"fr"}'`

**Note:** Local testing Python functions requires Vercel CLI: `vercel dev`

## 📝 Important Notes

### Vercel Function Limits

- **Hobby Plan:** 10s timeout per function
- **Pro Plan:** 60s timeout per function

For long translations, the system automatically chunks text.

### Python Package Source

**Option A: Use PyPI (Recommended)** ✅
- Already configured in `requirements.txt`
- `googletrans==4.0.2` will be installed automatically
- **Easiest - no file copying needed!**

**Option B: Use Local Source**
- Copy `googletrans` folder manually
- Requires proper folder structure
- More control over version

## 🚨 Troubleshooting

### "ModuleNotFoundError: No module named 'googletrans'"

**Solution:**
1. Check `requirements.txt` has `googletrans==4.0.2`
2. Redeploy on Vercel (sometimes dependencies need reinstall)
3. Check Vercel build logs for Python installation errors

### "Python API failed"

**Solution:**
1. Check Vercel function logs
2. Verify `api/translate.py` exists
3. Check `vercel.json` routes are correct
4. Test endpoint manually: `curl https://your-app.vercel.app/api/translate`

### Translation Timeouts

**Solution:**
- Text is automatically chunked for long content
- Consider upgrading Vercel plan for longer timeouts
- Or use Yandex API as primary (faster, free tier available)

## ✨ Summary

**To answer your question:**
- ✅ **Upload ONCE** to GitHub
- ✅ **Deploy ONCE** to Vercel  
- ✅ **Everything combined** - Node.js + Python in same repo
- ✅ **Vercel handles both** automatically

**No need to upload separately!** Everything is integrated and ready to deploy.

## 📚 Additional Resources

- See `GOOGLETRANS_SETUP.md` for detailed setup
- See `VERCEL_DEPLOYMENT.md` for Vercel-specific notes
- See `README.md` for Shopify app documentation

## 🎉 You're Ready!

1. ✅ Code is integrated
2. ✅ Dependencies configured
3. ✅ Vercel config updated
4. ⏭️ **Just push to GitHub and deploy!**

