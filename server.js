const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Main app route - redirect to install if no shop parameter
app.get('/', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.sendFile(path.join(__dirname, 'public', 'install.html'));
  }

  // For now, show the main interface
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'App is running',
    timestamp: new Date().toISOString()
  });
});

// Get real products with metafields
app.get('/api/products', authenticateShopify, async (req, res) => {
  try {
    const client = new shopify.clients.Rest({
      session: { shop: req.shop, accessToken: req.accessToken }
    });

    // First, get products with metafields
    const response = await client.get({
      path: 'products',
      query: {
        limit: 50,
        fields: 'id,title,handle'
      }
    });

    const products = response.body.products;
    const productsWithSpecs = [];

    // Check each product for custom.specification metafield
    for (const product of products) {
      try {
        const metafieldResponse = await client.get({
          path: `products/${product.id}/metafields`,
          query: {
            namespace: 'custom',
            key: 'specification'
          }
        });

        if (metafieldResponse.body.metafields && metafieldResponse.body.metafields.length > 0) {
          productsWithSpecs.push({
            id: product.id,
            title: product.title,
            handle: product.handle,
            metafields: metafieldResponse.body.metafields
          });
        }
      } catch (error) {
        console.error(`Error fetching metafields for product ${product.id}:`, error);
      }
    }

    res.json({
      success: true,
      products: productsWithSpecs,
      total: productsWithSpecs.length,
      message: `Found ${productsWithSpecs.length} products with custom.specification metafields`
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Real Shopify API integration
const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products', 'write_products'],
  hostName: process.env.HOST?.replace(/https?:\/\//, '') || 'localhost',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

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
async function translateWithMyMemory(text, sourceLanguage, targetLanguage) {
  try {
    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: text,
        langpair: `${sourceLanguage}|${targetLanguage}`
      }
    });

    if (response.data.responseStatus === 200) {
      return response.data.responseData.translatedText;
    } else {
      throw new Error('Translation failed');
    }
  } catch (error) {
    console.error('Translation error:', error);
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }
}

// Translate JSON content
async function translateJsonContent(jsonContent, sourceLanguage, targetLanguage) {
  if (typeof jsonContent === 'string') {
    return await translateWithMyMemory(jsonContent, sourceLanguage, targetLanguage);
  } else if (Array.isArray(jsonContent)) {
    return await Promise.all(
      jsonContent.map(item => translateJsonContent(item, sourceLanguage, targetLanguage))
    );
  } else if (jsonContent && typeof jsonContent === 'object') {
    const translated = {};
    for (const [key, value] of Object.entries(jsonContent)) {
      // Skip technical fields
      if (['id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin', 'url', 'link', 'image', 'images', 'video', 'videos', 'price', 'cost', 'weight', 'dimensions', 'size', 'color_code', 'hex', 'rgb', 'hsl', 'date', 'time', 'timestamp', 'created_at', 'updated_at', 'status', 'type', 'category', 'tags', 'keywords'].some(skipKey => 
        key.toLowerCase().includes(skipKey.toLowerCase())
      )) {
        translated[key] = value;
      } else {
        translated[key] = await translateJsonContent(value, sourceLanguage, targetLanguage);
      }
    }
    return translated;
  }
  return jsonContent;
}

// Get specific product metafield from Shopify
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

// Test translation API endpoint (preview only)
app.post('/api/test-translate', async (req, res) => {
  try {
    const { productId, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!productId || !targetLanguage) {
      return res.status(400).json({ error: 'Product ID and target language are required' });
    }

    // Get the metafield for the specific product
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield`);
    const metafieldData = metafieldResponse.data;
    
    if (!metafieldData.success || !metafieldData.metafield) {
      return res.status(404).json({ error: 'Metafield not found for this product' });
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
      productId: productId,
      originalContent: jsonContent,
      translatedContent: translatedContent,
      metafieldId: metafield.id,
      isTest: true,
      message: 'This is a test translation. Click "Make Live Translation" to apply it to the product.'
    });
  } catch (error) {
    console.error('Test translation error:', error);
    res.status(500).json({ error: 'Test translation failed' });
  }
});

// Translate API endpoint (actual translation)
app.post('/api/translate', async (req, res) => {
  try {
    const { productId, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!productId || !targetLanguage) {
      return res.status(400).json({ error: 'Product ID and target language are required' });
    }

    // Get the metafield for the specific product
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield`);
    const metafieldData = metafieldResponse.data;
    
    if (!metafieldData.success || !metafieldData.metafield) {
      return res.status(404).json({ error: 'Metafield not found for this product' });
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
      productId: productId,
      originalContent: jsonContent,
      translatedContent: translatedContent,
      metafieldId: metafield.id,
      isTest: false,
      message: 'Translation completed successfully!'
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Update metafield in Shopify
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
      metafield: response.body.metafield,
      message: 'Metafield updated successfully in Shopify!'
    });
  } catch (error) {
    console.error('Error updating metafield:', error);
    res.status(500).json({ error: 'Failed to update metafield' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Metafield Translator app running on port ${PORT}`);
});

module.exports = app;
