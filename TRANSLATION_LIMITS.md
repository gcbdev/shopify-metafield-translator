# Translation Limits & Troubleshooting Guide

## Why Some Products Didn't Translate to French

If some of your products didn't translate to French, here are the common reasons and how to fix them:

---

## 🚨 Main Translation Limits

### 1. **Google Translate Free Tier Limit** (Most Common Issue)
- **Limit:** 500,000 characters per month
- **What happens when exceeded:** 
  - API requests fail
  - System falls back to LibreTranslate or MyMemory
  - Fallback services may be slower or less accurate
- **How to check:** Look for `⚠️ Google Translate failed` messages in your console logs

**Solution:**
- Wait until next month for free tier to reset
- Use paid Google Translate API for higher limits
- Or rely on the fallback services (LibreTranslate/MyMemory)

---

### 2. **Shopify API Rate Limits**
- **REST API:** 40 requests per second (default)
- **GraphQL API:** 1000 points per second
- **What happens:** Some products might get skipped if rate limits are exceeded during bulk operations

**Good News:** Your app now includes automatic retry logic! If a product fails to translate, it will automatically retry once after 2 seconds.

---

### 3. **Translation Service Timeouts**
- **Previous:** No timeout set (could hang forever)
- **Now:** 30-second timeout per translation request
- **What happens:** Request cancels after 30 seconds and tries next service

---

## ✅ What I've Improved

### 1. Added Timeout Protection
- All translation services now have 30-second timeouts
- Prevents hanging on slow or unresponsive services

### 2. Added Automatic Retry
- Failed translations now retry once automatically
- 2-second delay between retry to respect rate limits

### 3. Better Error Logging
- More detailed error messages showing which service failed
- Easier to diagnose translation issues

### 4. Rate Limit Management
- Rate limit manager waits when API points are low
- Prevents hitting Shopify rate limits

---

## 🔍 How to Diagnose Translation Issues

### Check Your Console Logs
Look for these messages:

**Successful Translation:**
```
✅ Google Translate: "text" → "texte"
```

**Failed Translation (Automatic Retry):**
```
⚠️ Google Translate failed: Error message, trying LibreTranslate...
🔄 Retrying translation for product 123...
✅ Retry successful for product 123
```

**All Services Failed:**
```
❌ All translation services failed for: "text"
⚠️ Returning original text without translation
```

---

## 🎯 Solutions for Failed Translations

### Option 1: Re-run the Bulk Translation
The automatic retry should catch products that failed due to temporary issues:
```bash
# Restart your server and run bulk translate again
node server.js
```

### Option 2: Translate in Smaller Batches
Instead of translating all products at once, translate in smaller batches:

1. Check which products failed in your last batch
2. Use the test endpoint with `maxProducts=10` to test first
3. Gradually increase the batch size

### Option 3: Manual Translation for Important Products
For critical products, translate them individually through the UI.

### Option 4: Use Paid Translation Services
If you have a large catalog, consider:
- Google Cloud Translation API (paid)
- DeepL API (paid)
- Microsoft Azure Translator (paid)

Add the API keys to your environment variables.

---

## 📊 Current Translation Flow

1. **Try Google Translate** (500K chars/month free)
   - If fails → Try LibreTranslate
   
2. **Try LibreTranslate** (completely free)
   - If fails → Try MyMemory
   
3. **Try MyMemory** (free API)
   - If fails → Return original text (no translation)
   
4. **Automatic Retry**
   - If any step fails → Wait 2 seconds and retry entire process
   - If retry succeeds → Mark as successful
   - If retry fails → Mark as error

---

## 🛠️ How to Increase Translation Success Rate

### 1. Run Translation During Off-Peak Hours
- Translation services are less busy
- Better success rate for free services

### 2. Implement Exponential Backoff (Future Enhancement)
Currently set to wait 2 seconds between batches. Could be improved to:
- 2 seconds for first retry
- 4 seconds for second retry
- 8 seconds for third retry

### 3. Monitor Console Logs
Watch for patterns:
- Are certain products always failing?
- Is it the same error message?
- Are failures clustered in time?

### 4. Use the Test Endpoint First
Always test with a small batch before running full translation:
```bash
POST /api/bulk-translate-test
{
  "maxProducts": 10
}
```

---

## 📝 Summary

**What causes failed translations:**
1. ❌ Google Translate hitting 500K char/month limit
2. ⚠️ Rate limits on translation services
3. 🐌 Slow/unresponsive translation services
4. 🔒 API key issues or service outages

**What I fixed:**
1. ✅ Added 30-second timeouts
2. ✅ Added automatic retry logic
3. ✅ Improved error logging
4. ✅ Better rate limit management

**What you should do:**
1. Check console logs to identify which products failed
2. Re-run bulk translation (automatic retries should catch most issues)
3. Consider translating in smaller batches for large catalogs
4. For production, consider using paid translation services

---

## 💡 Quick Fix Command

To re-translate only failed products, you would need to:
1. Check the results from your last bulk translate
2. Extract the product IDs that failed
3. Create a custom script to translate just those products

Or simply re-run the entire bulk translation - the retry logic should catch most issues now!

---

**Questions?** Check your server console logs for detailed error messages about which products failed and why.

