# Shopify Metafield Translator App



This Shopify app allows you to translate specific product metafields that contain JSON-formatted data.



## Features

- Translate product metafields with JSON formatting
- Support for custom.specification metafield
- Secure API authentication with Shopify
- Web interface for managing translations
- **Free MyMemory translation API** - No API key required!
- Support for Google Translate, DeepL, and Azure (optional)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
SHOPIFY_API_KEY=816678fd4b1090ece40548e15b569dd5
SHOPIFY_API_SECRET=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
SHOPIFY_SCOPES=read_products,write_products,read_product_listings,write_product_listings
HOST=https://your-app-domain.com
PORT=3000
TRANSLATION_SERVICE=mymemory
```

3. Start the development server:
```bash
npm run dev
```

## Usage

1. Install the app in your Shopify store
2. Navigate to the app dashboard
3. Select products to translate their metafields
4. Choose target languages for translation
5. Apply translations to update metafields

## API Endpoints

- `GET /api/products` - List products with metafields
- `POST /api/translate` - Translate specific metafield
- `PUT /api/metafield/:id` - Update metafield with translation

## Security

- All API calls are authenticated with Shopify
- Sensitive data is encrypted
- Rate limiting implemented
  

------------------------