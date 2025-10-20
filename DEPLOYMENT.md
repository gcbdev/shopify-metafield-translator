# Deployment Guide

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **ngrok** or similar tunneling service for local development
3. **Translation API Key** (Google Translate, DeepL, or Azure)

## Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your actual values:
   ```
   SHOPIFY_API_KEY=816678fd4b1090ece40548e15b569dd5
   SHOPIFY_API_SECRET=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
   SHOPIFY_SCOPES=read_products,write_products,read_product_listings,write_product_listings
   HOST=https://your-ngrok-url.ngrok.io
   PORT=3000
   SESSION_SECRET=your-random-session-secret
   TARGET_METAFIELD=custom.specification
   TRANSLATION_API_KEY=your-translation-api-key
   TRANSLATION_SERVICE=google
   ```

3. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS URL and update your `.env` HOST variable.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Shopify App Setup

1. **Create a new app in your Shopify Partners dashboard:**
   - Go to [partners.shopify.com](https://partners.shopify.com)
   - Create a new app
   - Use your ngrok URL as the App URL
   - Set the Allowed redirection URL to: `https://your-ngrok-url.ngrok.io/auth/callback`

2. **Configure app settings:**
   - App URL: `https://your-ngrok-url.ngrok.io`
   - Allowed redirection URL: `https://your-ngrok-url.ngrok.io/auth/callback`
   - App proxy URL: `https://your-ngrok-url.ngrok.io`

3. **Install the app in your development store:**
   - Visit: `https://your-ngrok-url.ngrok.io/auth?shop=your-dev-store.myshopify.com`

## Production Deployment

### Option 1: Heroku

1. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set SHOPIFY_API_KEY=816678fd4b1090ece40548e15b569dd5
   heroku config:set SHOPIFY_API_SECRET=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
   heroku config:set HOST=https://your-app-name.herokuapp.com
   heroku config:set SESSION_SECRET=your-random-session-secret
   heroku config:set TRANSLATION_API_KEY=your-translation-api-key
   ```

3. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option 2: Railway

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically**

### Option 3: DigitalOcean App Platform

1. **Create a new app from GitHub**
2. **Configure environment variables**
3. **Deploy**

## Translation Service Setup

### Google Translate API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Translation API
3. Create credentials and get your API key
4. Set `TRANSLATION_SERVICE=google` and `TRANSLATION_API_KEY=your-key`

### DeepL API

1. Sign up at [DeepL API](https://www.deepl.com/pro-api)
2. Get your API key
3. Set `TRANSLATION_SERVICE=deepl` and `TRANSLATION_API_KEY=your-key`

### Azure Translator

1. Create a Translator resource in Azure
2. Get your subscription key
3. Set `TRANSLATION_SERVICE=azure` and `TRANSLATION_API_KEY=your-key`

## Testing

1. **Install the app in your development store**
2. **Create a test product with a `custom.specification` metafield containing JSON**
3. **Test the translation functionality**

## Troubleshooting

### Common Issues

1. **"Not authenticated" error:**
   - Check that your Shopify API credentials are correct
   - Ensure the app is properly installed in your store

2. **"Metafield not found" error:**
   - Verify the product has a `custom.specification` metafield
   - Check that the metafield contains valid JSON

3. **Translation errors:**
   - Verify your translation API key is valid
   - Check API quotas and limits

4. **CORS errors:**
   - Ensure your HOST environment variable matches your actual domain
   - Check that your Shopify app URL is correctly configured

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=shopify:*
```

## Security Considerations

1. **Never commit your `.env` file**
2. **Use HTTPS in production**
3. **Implement rate limiting**
4. **Validate all user inputs**
5. **Use secure session secrets**

## Support

For issues and questions:
- Check the [Shopify App Development documentation](https://shopify.dev/apps)
- Review the [Shopify API documentation](https://shopify.dev/api)
- Test with the [Shopify CLI](https://shopify.dev/apps/tools/cli)
