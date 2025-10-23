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

// Get total product count from your Shopify store
app.get('/api/products/count', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const accessToken = req.accessToken;
    const showAllProducts = req.query.showAll === 'true';

    console.log('=== PRODUCT COUNT SCAN START ===');
    console.log('Shop:', shop);
    console.log('Show all products:', showAllProducts);

    let totalCount = 0;
    let pageInfo = null;
    let hasMore = true;

    // Scan through all pages to get accurate count
    while (hasMore) {
      const params = {
        limit: 250,
        fields: 'id,title,handle'
      };
      
      if (pageInfo) {
        params.page_info = pageInfo;
      }

      const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        params: params
      });

      const products = response.data.products;
      totalCount += products.length;

      console.log(`Scanned ${products.length} products, total so far: ${totalCount}`);

      // Check for next page
      const linkHeader = response.headers['link'];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
        pageInfo = nextMatch ? nextMatch[1] : null;
        hasMore = !!pageInfo;
      } else {
        hasMore = false;
      }

      // Safety check to prevent infinite loops
      if (totalCount > 100000) {
        console.log('Safety limit reached, stopping scan');
        break;
      }
    }

    console.log('=== PRODUCT COUNT SCAN COMPLETE ===');
    console.log('Total products found:', totalCount);

    res.json({
      success: true,
      totalProducts: totalCount,
      message: `Found ${totalCount} total products in your store`
    });

  } catch (error) {
    console.error('Product count scan error:', error);
    res.status(500).json({ 
      error: 'Failed to scan products',
      details: error.message
    });
  }
});

// Get real products from your Shopify store
app.get('/api/products', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const limit = parseInt(req.query.limit) || 250; // Default to 250 products (Shopify's max)
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const showAllProducts = req.query.showAll === 'true'; // Option to show all products, not just those with metafields
    const maxLimit = 250; // Maximum limit for Shopify API
    const safeLimit = Math.min(Math.max(limit, 1), maxLimit);
    const offset = (page - 1) * safeLimit;
    const accessToken = req.accessToken;

    console.log('=== PRODUCTS API CALL START ===');
    console.log('Shop:', shop);
    console.log('Limit:', safeLimit);
    console.log('Page:', page);
    console.log('Offset:', offset);
    console.log('Access Token:', accessToken.substring(0, 10) + '...');
    console.log('API URL:', `https://${shop}/admin/api/2023-10/products.json`);

    // Get products from your store
    console.log('Making request to Shopify API...');
    const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        limit: safeLimit,
        fields: 'id,title,handle',
        page_info: req.query.page_info // Support Shopify's pagination
      }
    });

    console.log('Shopify API Response Status:', response.status);
    console.log('Number of products received:', response.data.products.length);
    console.log('First product:', response.data.products[0] ? response.data.products[0].title : 'No products');

    const products = response.data.products;
    let productsWithSpecs = [];

    if (showAllProducts) {
      console.log('Showing ALL products (not filtering by metafields)...');
      // Return all products without metafield filtering
      productsWithSpecs = products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        metafields: [] // Empty metafields array for products without specs
      }));
    } else {
      console.log('Checking metafields for each product...');
      // Check each product for custom.specification metafield with parallel processing
      const metafieldPromises = products.map(async (product) => {
        try {
          console.log(`Checking metafields for product ${product.id}: ${product.title}`);
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

          console.log(`Product ${product.id} metafields:`, metafieldResponse.data.metafields.length);
          if (metafieldResponse.data.metafields && metafieldResponse.data.metafields.length > 0) {
            return {
              id: product.id,
              title: product.title,
              handle: product.handle,
              metafields: metafieldResponse.data.metafields
            };
          } else {
            console.log(`❌ Product ${product.id} has no custom.specification metafield`);
            return null;
          }
        } catch (error) {
          console.error(`Error fetching metafields for product ${product.id}:`, error.message);
          return null;
        }
      });

      // Wait for all metafield requests to complete
      const metafieldResults = await Promise.all(metafieldPromises);
      
      // Filter out null results and add to productsWithSpecs
      productsWithSpecs = metafieldResults.filter(result => result !== null);
    }

    console.log('=== FINAL RESULTS ===');
    console.log('Total products received from Shopify:', products.length);
    console.log('Total products with specs:', productsWithSpecs.length);
    console.log('Products with specs:', productsWithSpecs.map(p => `${p.id}: ${p.title}`));
    console.log('=== DEBUGGING INFO ===');
    console.log('Requested limit:', safeLimit);
    console.log('Actual products returned:', products.length);
    console.log('Products with metafields:', productsWithSpecs.length);
    console.log('Filtering ratio:', `${productsWithSpecs.length}/${products.length} = ${Math.round((productsWithSpecs.length/products.length)*100)}%`);

    // Check if we've hit Shopify's 25,000 pagination limit
    const hasMoreProducts = response.data.products.length === safeLimit;
    const estimatedTotal = hasMoreProducts ? '25,000+' : products.length;

    res.json({
      success: true,
      products: productsWithSpecs,
      total: productsWithSpecs.length,
      totalShopifyProducts: products.length,
      limit: safeLimit,
      page: page,
      hasNextPage: hasMoreProducts,
      nextPageInfo: response.headers['link'] ? response.headers['link'].match(/<([^>]+)>; rel="next"/)?.[1] : null,
      message: `Found ${productsWithSpecs.length} products with custom.specification metafields from ${shop}. Showing page ${page} with ${safeLimit} products per page. ${hasMoreProducts ? 'Note: Shopify limits pagination to 25,000 products.' : ''}`
    });
  } catch (error) {
    console.error('=== ERROR FETCHING PRODUCTS ===');
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Shop:', req.shop);
    
    // Handle rate limiting specifically
    if (error.response?.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        details: 'Shopify API rate limit reached. Please wait before making more requests.',
        shop: req.shop,
        retryAfter: error.response.headers['retry-after'] || 60
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch products',
        details: error.message,
        shop: req.shop,
        status: error.response?.status,
        response: error.response?.data
      });
    }
  }
});

// OAuth callback route (removed as we are using direct API access for now)
// app.get('/auth/callback', async (req, res) => { ... });

// Translation service using multiple free APIs
async function translateText(text, sourceLanguage, targetLanguage) {
  // Try Google Translate first (free tier: 500,000 characters/month)
  try {
    console.log(`Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    
    // Google Translate API (free tier)
    const response = await axios.post('https://translate.googleapis.com/translate_a/single', null, {
      params: {
        client: 'gtx',
        sl: sourceLanguage,
        tl: targetLanguage,
        dt: 't',
        q: text
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data[0] && response.data[0][0]) {
      const translatedText = response.data[0][0][0];
      console.log(`✅ Google Translate: "${text}" → "${translatedText}"`);
      return translatedText;
    }
  } catch (error) {
    console.log('Google Translate failed, trying LibreTranslate...');
  }

  // Fallback to LibreTranslate (completely free)
  try {
    const response = await axios.post('https://libretranslate.de/translate', {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.translatedText) {
      console.log(`✅ LibreTranslate: "${text}" → "${response.data.translatedText}"`);
      return response.data.translatedText;
    }
  } catch (error) {
    console.log('LibreTranslate failed, trying MyMemory...');
  }

  // Fallback to MyMemory
  try {
    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: text,
        langpair: `${sourceLanguage}|${targetLanguage}`
      }
    });

    if (response.data.responseStatus === 200) {
      console.log(`✅ MyMemory: "${text}" → "${response.data.responseData.translatedText}"`);
      return response.data.responseData.translatedText;
    }
  } catch (error) {
    console.log('MyMemory failed, using fallback...');
  }

  // Final fallback - return original text with language tag
  console.log(`❌ All translation services failed for: "${text}"`);
  return `[${targetLanguage.toUpperCase()}] ${text}`;
}

// Translate JSON content - return ONLY the French translation
async function translateJsonContent(jsonContent, sourceLanguage, targetLanguage) {
  if (typeof jsonContent === 'string') {
    const translatedText = await translateText(jsonContent, sourceLanguage, targetLanguage);
    // Return only the translated text
    return translatedText;
  } else if (Array.isArray(jsonContent)) {
    return await Promise.all(
      jsonContent.map(item => translateJsonContent(item, sourceLanguage, targetLanguage))
    );
  } else if (jsonContent && typeof jsonContent === 'object') {
    const translated = {};
    for (const [key, value] of Object.entries(jsonContent)) {
      // Skip technical fields but allow Brand, Type, Compatibility, General to be translated
      const skipFields = ['id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin', 'url', 'link', 'image', 'images', 'video', 'videos', 'price', 'cost', 'weight', 'dimensions', 'size', 'color_code', 'hex', 'rgb', 'hsl', 'date', 'time', 'timestamp', 'created_at', 'updated_at', 'status', 'category', 'tags', 'keywords'];
      
      // Always translate Brand, Type, Compatibility, General fields and their values
      const alwaysTranslateFields = ['brand', 'type', 'compatibility', 'general'];
      
      if (alwaysTranslateFields.some(translateKey => 
        key.toLowerCase().includes(translateKey.toLowerCase())
      )) {
        console.log(`Translating field: ${key}`);
        // Translate the field name itself
        const translatedKey = await translateText(key, sourceLanguage, targetLanguage);
        const translatedValue = await translateJsonContent(value, sourceLanguage, targetLanguage);
        
        // Use the translated field name
        translated[translatedKey] = translatedValue;
      } else if (skipFields.some(skipKey => 
        key.toLowerCase().includes(skipKey.toLowerCase())
      )) {
        translated[key] = value;
      } else {
        // For other fields, translate both the key name and the value
        const translatedKey = await translateText(key, sourceLanguage, targetLanguage);
        const translatedValue = await translateJsonContent(value, sourceLanguage, targetLanguage);
        
        // Use only the translated key name
        translated[translatedKey] = translatedValue;
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

// Get specific metafield by ID (for frontend compatibility)
app.get('/api/metafield/:id', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const shop = req.shop;
    const accessToken = req.accessToken;

    const response = await axios.get(`https://${shop}/admin/api/2023-10/metafields/${id}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      metafield: response.data.metafield
    });
  } catch (error) {
    console.error('Error fetching metafield by ID:', error);
    res.status(500).json({ error: 'Failed to fetch metafield' });
  }
});

// Test translation API endpoint (preview only)
app.post('/api/test-translate', async (req, res) => {
  try {
    const { productId, targetLanguage, sourceLanguage = 'en' } = req.body;
    const shop = req.query.shop; // Get shop from query for this endpoint

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
    const shop = req.query.shop; // Get shop from query for this endpoint

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

// Create French translation for Translate & Adapt (updates the French column)
app.put('/api/metafield/:id', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    const { translatedContent, productId } = req.body;
    const shop = req.shop;
    const accessToken = req.accessToken;

    if (!translatedContent || !productId) {
      return res.status(400).json({ error: 'Translated content and product ID are required' });
    }

    console.log('Creating French translation for metafield:', id);
    console.log('Product ID:', productId);
    console.log('Translated content preview:', JSON.stringify(translatedContent).substring(0, 200) + '...');
    console.log('Metafield GraphQL ID:', `gid://shopify/Metafield/${id}`);
    
    // Check API token permissions
    try {
      const permissionsResponse = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      console.log('Shop info (to verify API access):', permissionsResponse.data.shop.name);
    } catch (permError) {
      console.error('API permission check failed:', permError.response?.data || permError.message);
    }

    // Use Shopify's GraphQL Translations API to register French translation
    // Based on: https://community.shopify.com/t/graphql-api-and-translation/158432
    const graphqlQuery = `
      mutation CreateTranslation($id: ID!, $translations: [TranslationInput!]!) {
        translationsRegister(resourceId: $id, translations: $translations) {
          userErrors {
            message
            field
          }
          translations {
            locale
            key
            value
          }
        }
      }
    `;

    // Generate digest for the metafield value (required for translation)
    // The digest should be of the ORIGINAL content, not the translated content
    const crypto = require('crypto');
    
    // First, get the original metafield content to generate the correct digest
    const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/metafields/${id}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    const originalMetafieldValue = metafieldResponse.data.metafield.value;
    const translatableContentDigest = crypto.createHash('sha256').update(originalMetafieldValue).digest('hex');
    
    console.log('Original metafield value:', originalMetafieldValue);
    console.log('Generated digest from original:', translatableContentDigest);
    console.log('Translated content:', JSON.stringify(translatedContent));

    const variables = {
      id: `gid://shopify/Metafield/${id}`,
      translations: [{
        key: "value",
        value: JSON.stringify(translatedContent),
        locale: "fr",
        translatableContentDigest: translatableContentDigest
      }]
    };

    console.log('GraphQL variables:', JSON.stringify(variables, null, 2));

    const response = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, {
      query: graphqlQuery,
      variables: variables
    }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('GraphQL response:', JSON.stringify(response.data, null, 2));

    // Check for GraphQL errors
    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      console.error('Full GraphQL response:', JSON.stringify(response.data, null, 2));
      
      // Don't return here - let the fallback method try
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    // Check for user errors in the mutation
    if (response.data.data && response.data.data.translationsRegister && response.data.data.translationsRegister.userErrors.length > 0) {
      console.error('GraphQL translation errors:', response.data.data.translationsRegister.userErrors);
      return res.status(400).json({ 
        error: 'Translation registration failed',
        details: response.data.data.translationsRegister.userErrors
      });
    }

    // Check if translation was successful
    if (response.data.data && response.data.data.translationsRegister && response.data.data.translationsRegister.translations) {
      res.json({
        success: true,
        translation: response.data.data.translationsRegister.translations[0],
        message: 'French translation registered with Translate & Adapt successfully!'
      });
    } else {
      console.error('Unexpected response structure:', response.data);
      return res.status(400).json({ 
        error: 'Unexpected response from Shopify',
        details: response.data
      });
    }
  } catch (error) {
    console.error('Error creating French translation:', error.response?.data || error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error details:', error.response?.data);
    
    // Fallback: Try creating a French locale metafield directly
    console.log('Attempting fallback method: Creating French locale metafield...');
    
    try {
      const fallbackResponse = await axios.post(`https://${shop}/admin/api/2023-10/metafields.json`, {
        metafield: {
          namespace: "custom",
          key: "specification",
          value: JSON.stringify(translatedContent),
          type: "json",
          owner_id: productId,
          owner_resource: "product",
          locale: "fr"
        }
      }, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      console.log('Fallback method successful:', fallbackResponse.data);
      
      res.json({
        success: true,
        translation: fallbackResponse.data.metafield,
        message: 'French translation created using fallback method!',
        method: 'fallback'
      });
      
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError.response?.data || fallbackError.message);
      
      res.status(500).json({ 
        error: 'Failed to create French translation (both methods failed)',
        details: {
          graphql_error: error.response?.data || error.message,
          fallback_error: fallbackError.response?.data || fallbackError.message,
          graphql_status: error.response?.status,
          fallback_status: fallbackError.response?.status
        }
      });
    }
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