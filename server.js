const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
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

// Main app route
app.get('/', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.sendFile(path.join(__dirname, 'public', 'install.html'));
  }

  // Show the main interface
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

// Simple authentication middleware using API credentials
const authenticateShopify = async (req, res, next) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Use Admin API access token for direct API access
    req.shop = shop;
    req.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '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';
    req.apiKey = process.env.SHOPIFY_API_KEY || '853a30498ded7d4a2fcdfa2787f463a2';
    req.apiSecret = process.env.SHOPIFY_API_SECRET || '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';
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Get real products from your Shopify store
app.get('/api/products', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const limit = parseInt(req.query.limit) || 10; // Default to 10 products
    const maxLimit = 250; // Maximum limit for performance
    const safeLimit = Math.min(Math.max(limit, 1), maxLimit);
    const accessToken = req.accessToken;

    // Get products from your store
    const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        limit: safeLimit,
        fields: 'id,title,handle'
      }
    });

    const products = response.data.products;
    const productsWithSpecs = [];

    // Check each product for custom.specification metafield
    for (const product of products) {
      try {
        const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${product.id}/metafields.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          params: {
            namespace: 'custom',
            key: 'specification'
          }
        });

        if (metafieldResponse.data.metafields && metafieldResponse.data.metafields.length > 0) {
          productsWithSpecs.push({
            id: product.id,
            title: product.title,
            handle: product.handle,
            metafields: metafieldResponse.data.metafields
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
      limit: safeLimit,
      message: `Found ${productsWithSpecs.length} products with custom.specification metafields from ${shop}. Use ?limit=X to control how many products to display.`
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message,
      shop: req.shop
    });
  }
});

// OAuth callback route
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;
    
    if (!code || !shop) {
      return res.status(400).send('Missing required parameters');
    }

    // Exchange code for access token
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code: code
    });

    const accessToken = response.data.access_token;
    req.session.accessToken = accessToken;
    req.session.shop = shop;

    res.redirect(`/?shop=${shop}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Translation service using MyMemory API
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

// Get specific product metafield from your Shopify store
app.get('/api/product/:id/metafield', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const shop = req.shop;
    const accessToken = req.accessToken;

    const response = await axios.get(`https://${shop}/admin/api/2023-10/products/${id}/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        namespace: 'custom',
        key: 'specification'
      }
    });

    res.json({
      success: true,
      metafield: response.data.metafields[0] || null
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
    const shop = req.query.shop;

    if (!productId || !targetLanguage) {
      return res.status(400).json({ error: 'Product ID and target language are required' });
    }

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Get the metafield for the specific product
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield?shop=${shop}`);
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
    const shop = req.query.shop;

    if (!productId || !targetLanguage) {
      return res.status(400).json({ error: 'Product ID and target language are required' });
    }

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Get the metafield for the specific product
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield?shop=${shop}`);
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

// Update metafield in your Shopify store
app.put('/api/metafield/:id', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const { translatedContent } = req.body;
    const shop = req.shop;
    const accessToken = req.accessToken;

    if (!translatedContent) {
      return res.status(400).json({ error: 'Translated content is required' });
    }

    const response = await axios.put(`https://${shop}/admin/api/2023-10/metafields/${id}.json`, {
      metafield: {
        id: id,
        value: JSON.stringify(translatedContent)
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      metafield: response.data.metafield,
      message: 'Metafield updated successfully in your Shopify store!'
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