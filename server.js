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

// Get total product count from your Shopify store (full scan)
app.get('/api/products/count', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const accessToken = req.accessToken;

    console.log('=== PRODUCT COUNT SCAN START ===');
    console.log('Shop:', shop);

    let totalCount = 0;
    let nextPageInfo = null;
    let pageCount = 0;

    // Get first page
    const firstResponse = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 250,
        fields: 'id,title,handle'
      }
    });

    const firstPageProducts = firstResponse.data.products;
    totalCount += firstPageProducts.length;
    pageCount++;

    console.log(`Page ${pageCount}: ${firstPageProducts.length} products, total so far: ${totalCount}`);

    // Check for pagination info in Link header
    const linkHeader = firstResponse.headers['link'];
    console.log('Link header:', linkHeader);
    
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
      if (nextMatch) {
        const nextUrl = nextMatch[1];
        // Extract page_info from the URL
        const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
        nextPageInfo = urlParams.get('page_info');
        console.log('Next page info found:', nextPageInfo);
      }
    }

    // Continue scanning if there are more pages
    while (nextPageInfo) {
      pageCount++;
      console.log(`Scanning page ${pageCount} with page_info: ${nextPageInfo}`);
      
      try {
        const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          params: {
            limit: 250,
            fields: 'id,title,handle',
            page_info: nextPageInfo
          }
        });

        // Check for rate limit headers
        const rateLimitRemaining = response.headers['x-shopify-shop-api-call-limit'];
        if (rateLimitRemaining) {
          const [used, total] = rateLimitRemaining.split('/').map(Number);
          const remaining = total - used;
          console.log(`Rate limit: ${used}/${total} used, ${remaining} remaining`);
          
          // If we're getting close to the limit, wait a bit
          if (remaining < 50) {
            console.log('Rate limit getting low, waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        const products = response.data.products;
        totalCount += products.length;

        console.log(`Page ${pageCount}: ${products.length} products, total so far: ${totalCount}`);

        // Check for next page
        const newLinkHeader = response.headers['link'];
        console.log('New link header:', newLinkHeader);
        
        if (newLinkHeader && newLinkHeader.includes('rel="next"')) {
          const nextMatch = newLinkHeader.match(/<([^>]+)>; rel="next"/);
          if (nextMatch) {
            const nextUrl = nextMatch[1];
            // Extract page_info from the URL
            const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
            nextPageInfo = urlParams.get('page_info');
            console.log('Found next page info:', nextPageInfo);
          } else {
            nextPageInfo = null;
            console.log('No more pages found');
          }
        } else {
          nextPageInfo = null;
          console.log('No more pages found');
        }

        // Safety check - increased limit for stores with many products
        if (pageCount > 500) {
          console.log('Safety limit reached (500 pages), stopping scan');
          break;
        }

      } catch (pageError) {
        console.error(`Error scanning page ${pageCount}:`, pageError.message);
        break;
      }
    }

    console.log('=== PRODUCT COUNT SCAN COMPLETE ===');
    console.log(`Total products found: ${totalCount} across ${pageCount} pages`);
    console.log(`Average products per page: ${Math.round(totalCount / pageCount)}`);
    console.log(`Expected pages for 4300+ products: ${Math.ceil(4300 / 250)}`);

    res.json({
      success: true,
      totalProducts: totalCount,
      message: `Found ${totalCount} total products in your store (scanned ${pageCount} pages)`,
      isEstimate: false,
      pagesScanned: pageCount,
      averagePerPage: Math.round(totalCount / pageCount)
    });

  } catch (error) {
    console.error('Product count scan error:', error);
    console.error('Error details:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
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
    const limit = parseInt(req.query.limit) || 250; // Default to 250 products per page
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
    
    // Check for rate limit headers
    const rateLimitRemaining = response.headers['x-shopify-shop-api-call-limit'];
    if (rateLimitRemaining) {
      const [used, total] = rateLimitRemaining.split('/').map(Number);
      const remaining = total - used;
      console.log(`Rate limit: ${used}/${total} used, ${remaining} remaining`);
    }

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
      nextPageInfo: (() => {
        const linkHeader = response.headers['link'];
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
          if (nextMatch) {
            const nextUrl = nextMatch[1];
            const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
            return urlParams.get('page_info');
          }
        }
        return null;
      })(),
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
      const retryAfter = parseInt(error.response.headers['retry-after']) || 2;
      console.log(`⏱️ Rate limit exceeded. Waiting ${retryAfter} seconds...`);
      
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      
      try {
        const retryResponse = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          params: {
            limit: safeLimit,
            fields: 'id,title,handle',
            page_info: req.query.page_info
          }
        });
        
        // Process the retry response...
        const retryData = retryResponse.data;
        const retryProducts = retryData.products;
        
        if (retryProducts.length > 0) {
          // Continue with the existing logic using retryData
          const productsWithSpecs = showAllProducts 
            ? retryProducts.map(product => ({ id: product.id, title: product.title, handle: product.handle, metafields: [] }))
            : await Promise.all(retryProducts.map(async (product) => {
              try {
                const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${product.id}/metafields.json`, {
                  headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
                  params: { namespace: 'custom', key: 'specification' }
                });
                if (metafieldResponse.data.metafields && metafieldResponse.data.metafields.length > 0) {
                  return { id: product.id, title: product.title, handle: product.handle, metafields: metafieldResponse.data.metafields };
                }
                return null;
              } catch (error) {
                console.error(`Error fetching metafields for product ${product.id}:`, error.message);
                return null;
              }
            })).then(results => results.filter(result => result !== null));
          
          return res.json({
            success: true,
            products: productsWithSpecs,
            total: productsWithSpecs.length,
            totalShopifyProducts: retryProducts.length,
            limit: safeLimit,
            page: page,
            hasNextPage: retryProducts.length === safeLimit,
            nextPageInfo: (() => {
              const linkHeader = retryResponse.headers['link'];
              if (linkHeader && linkHeader.includes('rel="next"')) {
                const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
                if (nextMatch) {
                  const nextUrl = nextMatch[1];
                  const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
                  return urlParams.get('page_info');
                }
              }
              return null;
            })(),
            message: `Found ${productsWithSpecs.length} products with custom.specification metafields from ${shop}. Showing page ${page} with ${safeLimit} products per page.`
          });
        }
      } catch (retryError) {
        // If retry also fails, return error
        return res.status(429).json({ 
        error: 'Rate limit exceeded',
          details: 'Shopify API rate limit reached. Please wait and try again.',
        shop: req.shop,
          retryAfter: retryAfter
      });
      }
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
      // Skip only very technical fields that shouldn't be translated
      const skipFields = ['id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin', 'url', 'link', 'image', 'images', 'video', 'videos', 'price', 'cost', 'weight', 'dimensions', 'size', 'color_code', 'hex', 'rgb', 'hsl', 'date', 'time', 'timestamp', 'created_at', 'updated_at', 'status'];
      
      if (skipFields.some(skipKey => 
        key.toLowerCase().includes(skipKey.toLowerCase())
      )) {
        // Keep technical fields unchanged
        translated[key] = value;
      } else {
        // Translate ALL other field names and their values (including "General specifications", "Stand properties", etc.)
        console.log(`Translating field: ${key}`);
        const translatedKey = await translateText(key, sourceLanguage, targetLanguage);
        const translatedValue = await translateJsonContent(value, sourceLanguage, targetLanguage);
        
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

// Get French content for a metafield
app.get('/api/metafield/:id/french', async (req, res) => {
  try {
    const { id } = req.params;
    const shop = req.query.shop;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return res.status(400).json({ success: false, error: 'Missing shop or access token' });
    }

    console.log(`🔍 Getting French content for metafield ${id} for shop ${shop}`);

    // First get the original metafield to find the product ID
    const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/metafields/${id}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    const metafield = metafieldResponse.data.metafield;
    const productId = metafield.owner_id;
    
    console.log(`📦 Product ID: ${productId}`);
    console.log(`🏷️ Metafield namespace: ${metafield.namespace}, key: ${metafield.key}`);
    console.log(`🆔 Metafield ID from API: ${id}`);

    // STEP 1: We already have the metafield ID from the REST API call
    const metafieldGid = `gid://shopify/Metafield/${id}`;
    console.log(`📝 Using metafield GID: ${metafieldGid}`);

    // STEP 2: Query French translation at PRODUCT level (not metafield level!)
    console.log('=== Querying French translation at PRODUCT level ===');
    console.log(`Product ID: ${productId}, GID: gid://shopify/Product/${productId}`);
    
    let translationResponse;
    try {
      const translationQuery = `
        query GetProductTranslations($productId: ID!) {
          translations(
            resourceType: PRODUCT,
            resourceId: $productId,
            locale: "fr"
          ) {
            key
            value
          }
        }
      `;
      
      translationResponse = await axios.post(`https://${shop}/admin/api/2025-01/graphql.json`, {
        query: translationQuery,
        variables: {
          productId: `gid://shopify/Product/${productId}`
        }
      }, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ 2025-01 translation query succeeded');
    } catch (err) {
      console.log('2025-01 translation query failed, trying 2024-10...', err.message);
      try {
        const translationQuery2024 = `
          query GetProductTranslations($productId: ID!) {
            translations(
              resourceType: PRODUCT,
              resourceId: $productId,
              locale: "fr"
            ) {
              key
              value
            }
          }
        `;
        
        translationResponse = await axios.post(`https://${shop}/admin/api/2024-10/graphql.json`, {
          query: translationQuery2024,
          variables: {
            productId: `gid://shopify/Product/${productId}`
          }
        }, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ 2024-10 translation query succeeded');
      } catch (err2) {
        console.log('Both translation queries failed:', err2.message);
        translationResponse = null;
      }
    }

    // Process translation response
    if (translationResponse && translationResponse.data) {
      console.log(`📊 Translation response:`, JSON.stringify(translationResponse.data, null, 2));
      
      // Check for GraphQL errors
      if (translationResponse.data.errors) {
        console.log(`❌ GraphQL errors:`, translationResponse.data.errors);
      }
      
      const translations = translationResponse.data.data?.translations || [];
      console.log(`🌍 Found ${translations.length} translations`);
      
      if (translations.length > 0) {
        console.log(`✅ Translations found!`);
        console.log(`All translation keys:`, translations.map(t => t.key));
        console.log(`Sample translation values:`, translations.map(t => {
          const val = t.value || '';
          return val.substring ? val.substring(0, 50) : String(val).substring(0, 50);
        }));
        
        // Look for the metafield translation using the correct key format
        const metafieldKey = `metafields.${metafield.namespace}.${metafield.key}`;
        console.log(`Looking for translation with key: ${metafieldKey}`);
        
        const metafieldTranslation = translations.find(t => t.key === metafieldKey);
        
        if (metafieldTranslation) {
          console.log(`✅ Found French metafield translation!`);
          console.log(`Translation value length: ${metafieldTranslation.value.length}`);
          res.json({
            success: true,
            frenchContent: metafieldTranslation.value
          });
          return;
        } else {
          console.log(`⚠️ No metafield translation found. Available keys:`, translations.map(t => t.key));
        }
      } else {
        console.log(`❌ No translations returned from API`);
        console.log(`Response structure:`, Object.keys(translationResponse.data));
        if (translationResponse.data.data) {
          console.log(`Data keys:`, Object.keys(translationResponse.data.data));
        }
      }
    } else {
      console.log(`❌ No translation response received`);
    }

    // If no translation found, return error
    console.log(`❌ No French translation found for metafield ${id}`);
    res.json({
      success: false,
      error: 'No French translation found',
      debug: {
        productId: productId,
        metafieldId: id,
        namespace: metafield.namespace,
        key: metafield.key
      }
    });
  } catch (error) {
    console.error('❌ Error getting French content:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get French content',
      details: error.response?.data || error.message
    });
  }
});


// Debug endpoint to test French content retrieval
app.get('/api/debug-french/:metafieldId', async (req, res) => {
  try {
    const { metafieldId } = req.params;
    const shop = req.query.shop;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    console.log(`🔍 DEBUG: Testing French content for metafield ${metafieldId}`);

    // Get the metafield
    const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/metafields/${metafieldId}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    const metafield = metafieldResponse.data.metafield;
    const productId = metafield.owner_id;

    // Test the GraphQL query directly
    const graphqlQuery = `
      query GetMetafieldTranslations($id: ID!) {
        metafield(id: $id) {
          id
          namespace
          key
          value
          translations(locales: [fr]) {
            locale
            value
          }
        }
      }
    `;

    const graphqlResponse = await axios.post(`https://${shop}/admin/api/2023-10/graphql.json`, {
      query: graphqlQuery,
      variables: {
        id: `gid://shopify/Metafield/${metafieldId}`
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    // Get all metafields for this product
    const allMetafieldsResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${productId}/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    const allMetafields = allMetafieldsResponse.data.metafields;

    res.json({
      success: true,
      debug: {
        metafieldId: metafieldId,
        productId: productId,
        originalMetafield: {
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value.substring(0, 200) + '...'
        },
        graphqlResponse: graphqlResponse.data,
        allMetafields: allMetafields.map(m => ({
          id: m.id,
          namespace: m.namespace,
          key: m.key,
          value: m.value.substring(0, 100) + '...'
        }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
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

    // STEP 1: ALWAYS translate original content to English first
    console.log('STEP 1: Translating original content to English first...');
    const englishContent = await translateJsonContent(jsonContent, sourceLanguage, 'en');
    
    // STEP 2: Translate English content to target language
    console.log(`STEP 2: Translating English content to ${targetLanguage}...`);
    const translatedContent = await translateJsonContent(englishContent, 'en', targetLanguage);

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

// Endpoint to translate metafield content to English (updates original metafield)
app.post('/api/translate-to-english', async (req, res) => {
  try {
    const { metafieldId, content, sourceLanguage } = req.body;
    const shop = req.query.shop;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Missing shop or access token' });
    }

    if (!metafieldId || !content) {
      return res.status(400).json({ error: 'Missing metafieldId or content' });
    }

    console.log(`Translating metafield ${metafieldId} to English...`);
    console.log('Source language:', sourceLanguage);
    console.log('Original content:', JSON.stringify(content, null, 2));

    // FORCE translate to English - always translate regardless of detected language
    console.log('FORCE translating to English (no language check)...');

    // Force translation by using a different source language if detected as English
    let forceSourceLanguage = sourceLanguage;
    if (sourceLanguage === 'en') {
      // If detected as English, force it to be treated as French to ensure translation
      forceSourceLanguage = 'fr';
      console.log('Content detected as English, forcing source language to French to ensure translation');
    }

    // Translate the content to English
    const englishContent = await translateJsonContent(content, forceSourceLanguage, 'en');
    
    console.log('English content:', JSON.stringify(englishContent, null, 2));

    // Update the original metafield with English content
    const updateData = {
      metafield: {
        value: JSON.stringify(englishContent)
      }
    };

    console.log('Updating metafield with English content...');
    
    const response = await axios.put(`https://${shop}/admin/api/2023-10/metafields/${metafieldId}.json`, updateData, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('Metafield update response:', response.status);

    if (response.status === 200) {
      res.json({
        success: true,
        translatedContent: englishContent,
        message: 'Metafield successfully updated to English content'
      });
    } else {
      throw new Error(`Failed to update metafield: ${response.status}`);
    }

  } catch (error) {
    console.error('Error translating to English:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to translate to English',
      details: error.response?.data || error.message
    });
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

    // STEP 1: ALWAYS translate original content to English first
    console.log('STEP 1: Translating original content to English first...');
    const englishContent = await translateJsonContent(jsonContent, sourceLanguage, 'en');
    
    // STEP 2: Translate English content to target language
    console.log(`STEP 2: Translating English content to ${targetLanguage}...`);
    const translatedContent = await translateJsonContent(englishContent, 'en', targetLanguage);

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
    console.log('Original content preview:', JSON.stringify(translatedContent).substring(0, 200) + '...');
    console.log('Metafield GraphQL ID:', `gid://shopify/Metafield/${id}`);
    
    // Translate content from English to French
    console.log('Translating content to French...');
    const frenchContent = await translateJsonContent(translatedContent, 'en', 'fr');
    console.log('French content preview:', JSON.stringify(frenchContent).substring(0, 200) + '...');
    
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

    // Use Shopify's GraphQL Translations API to fill the French field
    // This fills the French field in Shopify's interface without modifying the original
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
    const crypto = require('crypto');
    
    // Get the original metafield content to generate the correct digest
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
    console.log('French content to fill:', JSON.stringify(frenchContent).substring(0, 200) + '...');

    const variables = {
      id: `gid://shopify/Metafield/${id}`,
      translations: [{
        key: "value",
        value: JSON.stringify(frenchContent),
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
        message: 'French field filled successfully! Original content remains unchanged.'
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
    
    res.status(500).json({ 
      error: 'Failed to create French translation',
      details: error.response?.data || error.message,
      status: error.response?.status
    });
  }
});

// Bulk translate ALL products to French
app.post('/api/bulk-translate-all', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const accessToken = req.accessToken;
    const targetLanguage = req.body.targetLanguage || 'fr';
    const sourceLanguage = req.body.sourceLanguage || 'en';

    console.log('=== BULK TRANSLATE ALL START ===');
    console.log('Shop:', shop);
    console.log('Target Language:', targetLanguage);
    console.log('Source Language:', sourceLanguage);

    // Set a longer timeout for this operation
    res.setTimeout(300000); // 5 minutes timeout

    let allProducts = [];
    let nextPageInfo = null;

    // First, get ALL products from the store
    console.log('Fetching all products...');
    
    // Get first page
    const firstResponse = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 250,
        fields: 'id,title,handle'
      }
    });

    allProducts = [...firstResponse.data.products];
    console.log(`First page: ${firstResponse.data.products.length} products`);

    // Check for pagination
    const linkHeader = firstResponse.headers['link'];
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
      if (nextMatch) {
        const nextUrl = nextMatch[1];
        const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
        nextPageInfo = urlParams.get('page_info');
        console.log('Found pagination, continuing...');
      }
    }

    // Continue fetching all pages
    while (nextPageInfo) {
      try {
        const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          params: {
            limit: 250,
            fields: 'id,title,handle',
            page_info: nextPageInfo
          }
        });

        allProducts = [...allProducts, ...response.data.products];
        console.log(`Page: ${response.data.products.length} products, Total so far: ${allProducts.length}`);

        // Check for next page
        const newLinkHeader = response.headers['link'];
        if (newLinkHeader && newLinkHeader.includes('rel="next"')) {
          const nextMatch = newLinkHeader.match(/<([^>]+)>; rel="next"/);
          if (nextMatch) {
            const nextUrl = nextMatch[1];
            const urlParams = new URLSearchParams(nextUrl.split('?')[1]);
            nextPageInfo = urlParams.get('page_info');
          } else {
            nextPageInfo = null;
          }
        } else {
          nextPageInfo = null;
        }

        // Safety check - increased limit for stores with many products
        if (allProducts.length > 50000) {
          console.log('Safety limit reached (50,000 products), stopping fetch');
          break;
        }

      } catch (pageError) {
        console.error('Error fetching page:', pageError.message);
        break;
      }
    }

    console.log(`Total products to translate: ${allProducts.length}`);

    // Now translate all products
    const results = {
      totalProducts: allProducts.length,
      processed: 0,
      errors: 0,
      success: 0,
      skipped: 0,
      details: []
    };

    // Process products in batches to avoid overwhelming the API
    const batchSize = 5; // Smaller batches for better rate limit management
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allProducts.length/batchSize)} (${batch.length} products)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (product) => {
        try {
          // Check if product has metafield
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

          if (metafieldResponse.data.metafields.length === 0) {
            return { productId: product.id, status: 'skipped', reason: 'No metafield found', title: product.title };
          }

          const metafield = metafieldResponse.data.metafields[0];
          let jsonContent;

          try {
            jsonContent = JSON.parse(metafield.value);
          } catch (parseError) {
            return { productId: product.id, status: 'error', reason: 'Invalid JSON in metafield', title: product.title };
          }

          // STEP 1: ALWAYS translate original content to English first
          console.log(`STEP 1: Translating original content to English for product ${product.id}...`);
          const englishContent = await translateJsonContent(jsonContent, sourceLanguage, 'en');
          
          // STEP 2: Translate English content to French
          console.log(`STEP 2: Translating English content to French for product ${product.id}...`);
          const frenchContent = await translateJsonContent(englishContent, 'en', 'fr');

          // Use Shopify's GraphQL Translations API to fill the French field
          // This fills the French field in Shopify's interface without modifying the original
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
          const crypto = require('crypto');
          const originalMetafieldValue = metafield.value;
          const translatableContentDigest = crypto.createHash('sha256').update(originalMetafieldValue).digest('hex');

          const variables = {
            id: `gid://shopify/Metafield/${metafield.id}`,
            translations: [{
              key: "value",
              value: JSON.stringify(frenchContent),
              locale: "fr",
              translatableContentDigest: translatableContentDigest
            }]
          };

          console.log(`Attempting GraphQL translation for product ${product.id}...`);
          console.log('Metafield ID:', metafield.id);
          console.log('Digest:', translatableContentDigest);

          try {
            const response = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, {
              query: graphqlQuery,
              variables: variables
      }, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

            console.log(`GraphQL response for product ${product.id}:`, response.status);

            if (response.data.errors) {
              console.error(`GraphQL errors for product ${product.id}:`, response.data.errors);
              throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
            }

            if (response.data.data?.translationsRegister?.userErrors?.length > 0) {
              console.error(`GraphQL translation errors for product ${product.id}:`, response.data.data.translationsRegister.userErrors);
              throw new Error(`Translation registration failed: ${JSON.stringify(response.data.data.translationsRegister.userErrors)}`);
            }

            if (response.data.data?.translationsRegister?.translations?.length > 0) {
              console.log(`✅ French field filled for product ${product.id}`);
              return {
                productId: product.id,
                status: 'success',
                title: product.title,
                translation: response.data.data.translationsRegister.translations[0]
              };
            } else {
              throw new Error('No translations were registered');
            }

          } catch (graphqlError) {
            console.error(`GraphQL translation failed for product ${product.id}:`, graphqlError.message);
            throw graphqlError;
          }

          return { productId: product.id, status: 'success', title: product.title };

        } catch (error) {
          console.error(`Error translating product ${product.id}:`, error.message);
          return { productId: product.id, status: 'error', reason: error.message, title: product.title };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Update results
      batchResults.forEach(result => {
        results.processed++;
        if (result.status === 'success') {
          results.success++;
        } else if (result.status === 'error') {
          results.errors++;
        } else if (result.status === 'skipped') {
          results.skipped++;
        }
        results.details.push(result);
      });

      // Rate limiting - wait between batches
      if (i + batchSize < allProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }

    console.log('=== BULK TRANSLATE ALL COMPLETE ===');
    console.log(`Total processed: ${results.processed}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Skipped: ${results.skipped}`);
      
      res.json({
        success: true,
      message: `Bulk translation completed! Processed ${results.processed} products. ${results.success} successful, ${results.errors} errors, ${results.skipped} skipped.`,
      results: results
      });
      
  } catch (error) {
    console.error('Bulk translate all error:', error);
      res.status(500).json({ 
      error: 'Bulk translation failed',
      details: error.message
    });
  }
});

// Test bulk translate with limited products (for testing)
app.post('/api/bulk-translate-test', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    const accessToken = req.accessToken;
    const targetLanguage = req.body.targetLanguage || 'fr';
    const sourceLanguage = req.body.sourceLanguage || 'en';
    const maxProducts = req.body.maxProducts || 10; // Test with only 10 products

    console.log('=== BULK TRANSLATE TEST START ===');
    console.log('Shop:', shop);
    console.log('Max Products:', maxProducts);

    // Get first page only for testing
    const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        limit: Math.min(maxProducts, 250),
        fields: 'id,title,handle'
      }
    });

    const products = response.data.products;
    console.log(`Testing with ${products.length} products`);

    const results = {
      totalProducts: products.length,
      processed: 0,
      errors: 0,
      success: 0,
      skipped: 0,
      details: []
    };

    // Process products one by one for testing
    for (const product of products) {
      try {
        console.log(`Processing product ${product.id}: ${product.title}`);
        
        // Check if product has metafield
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

        if (metafieldResponse.data.metafields.length === 0) {
          results.details.push({ productId: product.id, status: 'skipped', reason: 'No metafield found', title: product.title });
          results.skipped++;
          continue;
        }

        const metafield = metafieldResponse.data.metafields[0];
        let jsonContent;

        try {
          jsonContent = JSON.parse(metafield.value);
        } catch (parseError) {
          results.details.push({ productId: product.id, status: 'error', reason: 'Invalid JSON in metafield', title: product.title });
          results.errors++;
          continue;
        }

        // STEP 1: ALWAYS translate original content to English first
        console.log(`STEP 1: Translating original content to English for product ${product.id}...`);
        const englishContent = await translateJsonContent(jsonContent, sourceLanguage, 'en');
        
        // STEP 2: Translate English content to French
        console.log(`STEP 2: Translating English content to French for product ${product.id}...`);
        const frenchContent = await translateJsonContent(englishContent, 'en', 'fr');

        // Use Shopify's GraphQL Translations API to fill the French field
        // This fills the French field in Shopify's interface without modifying the original
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
        const crypto = require('crypto');
        const originalMetafieldValue = metafield.value;
        const translatableContentDigest = crypto.createHash('sha256').update(originalMetafieldValue).digest('hex');

        const variables = {
          id: `gid://shopify/Metafield/${metafield.id}`,
          translations: [{
            key: "value",
            value: JSON.stringify(frenchContent),
            locale: "fr",
            translatableContentDigest: translatableContentDigest
          }]
        };

        console.log(`Attempting GraphQL translation for product ${product.id}...`);
        console.log('Metafield ID:', metafield.id);
        console.log('Digest:', translatableContentDigest);

        try {
          const response = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, {
            query: graphqlQuery,
            variables: variables
          }, {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          });

          console.log(`GraphQL response for product ${product.id}:`, response.status);

          if (response.data.errors) {
            console.error(`GraphQL errors for product ${product.id}:`, response.data.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
          }

          if (response.data.data?.translationsRegister?.userErrors?.length > 0) {
            console.error(`GraphQL translation errors for product ${product.id}:`, response.data.data.translationsRegister.userErrors);
            throw new Error(`Translation registration failed: ${JSON.stringify(response.data.data.translationsRegister.userErrors)}`);
          }

          if (response.data.data?.translationsRegister?.translations?.length > 0) {
            console.log(`✅ French field filled for product ${product.id}`);
            results.details.push({ 
              productId: product.id, 
              status: 'success', 
              title: product.title,
              translation: response.data.data.translationsRegister.translations[0]
            });
            results.success++;
          } else {
            throw new Error('No translations were registered');
          }

        } catch (graphqlError) {
          console.error(`GraphQL translation failed for product ${product.id}:`, graphqlError.message);
          throw graphqlError;
        }

      } catch (error) {
        console.error(`Error translating product ${product.id}:`, error.message);
        results.details.push({ productId: product.id, status: 'error', reason: error.message, title: product.title });
        results.errors++;
      }

      results.processed++;
      
      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('=== BULK TRANSLATE TEST COMPLETE ===');
    console.log(`Total processed: ${results.processed}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Skipped: ${results.skipped}`);

    res.json({
      success: true,
      message: `Test bulk translation completed! Processed ${results.processed} products. ${results.success} successful, ${results.errors} errors, ${results.skipped} skipped.`,
      results: results
    });

  } catch (error) {
    console.error('Bulk translate test error:', error);
    res.status(500).json({
      error: 'Bulk translation test failed',
      details: error.message
    });
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