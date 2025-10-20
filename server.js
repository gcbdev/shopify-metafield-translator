const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const TranslationService = require('./translation-service');
require('dotenv').config();

const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
const { ApiVersion } = require('@shopify/shopify-api');

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products', 'write_products'],
  hostName: process.env.HOST?.replace(/https?:\/\//, '') || 'localhost',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const authenticateShopify = async (req, res, next) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // In a real app, you'd store and retrieve the access token from a database
    // For this example, we'll use the session
    const accessToken = req.session.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.shopify = shopify;
    req.shop = shop;
    req.accessToken = accessToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Routes

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;
    
    if (!code || !shop) {
      return res.status(400).send('Missing required parameters');
    }

    // Exchange code for access token
    const client = new shopify.clients.Rest({ session: { shop, accessToken: '' } });
    const response = await client.post({
      path: 'oauth/access_token',
      data: {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code
      }
    });

    const accessToken = response.body.access_token;
    req.session.accessToken = accessToken;
    req.session.shop = shop;

    res.redirect(`/?shop=${shop}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Install route
app.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) {
    return res.status(400).send('Shop parameter is required');
  }

  const authUrl = shopify.auth.buildAuthURL({
    shop,
    redirectPath: '/auth/callback'
  });

  res.redirect(authUrl);
});

// Main app route
app.get('/', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.sendFile(path.join(__dirname, 'public', 'install.html'));
  }

  if (!req.session.accessToken) {
    return res.redirect(`/auth?shop=${shop}`);
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get products with metafields
app.get('/api/products', authenticateShopify, async (req, res) => {
  try {
    const client = new shopify.clients.Rest({
      session: { shop: req.shop, accessToken: req.accessToken }
    });

    const response = await client.get({
      path: 'products',
      query: {
        limit: 50,
        fields: 'id,title,handle,metafields'
      }
    });

    // Filter products that have the custom.specification metafield
    const productsWithSpecs = response.body.products.filter(product => 
      product.metafields && product.metafields.some(metafield => 
        metafield.namespace === 'custom' && metafield.key === 'specification'
      )
    );

    res.json({
      success: true,
      products: productsWithSpecs,
      total: productsWithSpecs.length
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get specific product metafield
app.get('/api/product/:id/metafield', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const client = new shopify.clients.Rest({
      session: { shop: req.shop, accessToken: req.accessToken }
    });

    const response = await client.get({
      path: `products/${id}/metafields`,
      query: {
        namespace: 'custom',
        key: 'specification'
      }
    });

    res.json({
      success: true,
      metafield: response.body.metafields[0] || null
    });
  } catch (error) {
    console.error('Error fetching metafield:', error);
    res.status(500).json({ error: 'Failed to fetch metafield' });
  }
});

// Translate metafield content
app.post('/api/translate', authenticateShopify, async (req, res) => {
  try {
    const { productId, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!productId || !targetLanguage) {
      return res.status(400).json({ error: 'Product ID and target language are required' });
    }

    // Get the metafield
    const metafieldResponse = await fetch(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield?shop=${req.shop}`, {
      headers: {
        'Cookie': req.headers.cookie
      }
    });

    const metafieldData = await metafieldResponse.json();
    
    if (!metafieldData.success || !metafieldData.metafield) {
      return res.status(404).json({ error: 'Metafield not found' });
    }

    const metafield = metafieldData.metafield;
    let jsonContent;

    try {
      jsonContent = JSON.parse(metafield.value);
    } catch (error) {
      return res.status(400).json({ error: 'Metafield content is not valid JSON' });
    }

    // Translate the JSON content
    const translatedContent = await translateJsonContent(jsonContent, sourceLanguage, targetLanguage);

    res.json({
      success: true,
      originalContent: jsonContent,
      translatedContent: translatedContent,
      metafieldId: metafield.id
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Update metafield with translation
app.put('/api/metafield/:id', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const { translatedContent } = req.body;

    if (!translatedContent) {
      return res.status(400).json({ error: 'Translated content is required' });
    }

    const client = new shopify.clients.Rest({
      session: { shop: req.shop, accessToken: req.accessToken }
    });

    const response = await client.put({
      path: `metafields/${id}`,
      data: {
        metafield: {
          id: id,
          value: JSON.stringify(translatedContent)
        }
      }
    });

    res.json({
      success: true,
      metafield: response.body.metafield
    });
  } catch (error) {
    console.error('Error updating metafield:', error);
    res.status(500).json({ error: 'Failed to update metafield' });
  }
});

// Initialize translation service
const translationService = new TranslationService(
  process.env.TRANSLATION_API_KEY,
  process.env.TRANSLATION_SERVICE || 'mymemory'
);

// Translation helper function
async function translateJsonContent(jsonContent, sourceLanguage, targetLanguage) {
  return await translationService.translateJsonObject(jsonContent, sourceLanguage, targetLanguage);
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Shopify Metafield Translator app running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});
