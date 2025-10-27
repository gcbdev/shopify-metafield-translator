const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Environment variables
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;

// Translation service
const { translateText } = require('./translation-service');

// Helper function to translate JSON content
async function translateJsonContent(jsonContent, sourceLanguage, targetLanguage) {
  if (typeof jsonContent === 'string') {
    return await translateText(jsonContent, sourceLanguage, targetLanguage);
  } else if (Array.isArray(jsonContent)) {
    return await Promise.all(
      jsonContent.map(item => translateJsonContent(item, sourceLanguage, targetLanguage))
    );
  } else if (jsonContent && typeof jsonContent === 'object') {
    const translated = {};
    for (const [key, value] of Object.entries(jsonContent)) {
      // Skip technical fields that shouldn't be translated
      const skipFields = ['id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin', 'url', 'link', 'image', 'images', 'video', 'videos', 'price', 'cost', 'weight', 'dimensions', 'size', 'color_code', 'hex', 'rgb', 'hsl', 'date', 'time', 'timestamp', 'created_at', 'updated_at', 'status'];
      
      if (skipFields.some(skipKey => key.toLowerCase().includes(skipKey.toLowerCase()))) {
        translated[key] = value;
      } else {
        // Translate field names and values
        const translatedKey = await translateText(key, sourceLanguage, targetLanguage);
        const translatedValue = await translateJsonContent(value, sourceLanguage, targetLanguage);
        translated[translatedKey] = translatedValue;
      }
    }
    return translated;
  }
  return jsonContent;
}

// Get all products with their specification metafields
app.get('/api/products', async (req, res) => {
  try {
    const shop = req.query.shop || SHOPIFY_SHOP;
    const accessToken = SHOPIFY_ACCESS_TOKEN;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Missing shop or access token' });
    }

    console.log(`📦 Fetching products for shop: ${shop}, page: ${page}, limit: ${limit}`);

    // Fetch products with metafields
    const productsResponse = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      },
      params: {
        limit: limit,
        fields: 'id,title,handle,metafields'
      }
    });

    const products = productsResponse.data.products;
    console.log(`✅ Found ${products.length} products`);

    // Process each product to get specification metafield
    const productsWithSpecs = await Promise.all(
      products.map(async (product) => {
        try {
          // Get metafields for this product
          const metafieldsResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${product.id}/metafields.json`, {
            headers: {
              'X-Shopify-Access-Token': accessToken
            }
          });

          const metafields = metafieldsResponse.data.metafields;
          const specificationMetafield = metafields.find(m => m.namespace === 'custom' && m.key === 'specification');
          
          return {
            ...product,
            specificationMetafield: specificationMetafield || null,
            metafields: metafields
          };
        } catch (error) {
          console.error(`❌ Error fetching metafields for product ${product.id}:`, error.message);
          return {
            ...product,
            specificationMetafield: null,
            metafields: []
          };
        }
      })
    );

    // Get pagination info
    const linkHeader = productsResponse.headers.link;
    let hasNextPage = false;
    let nextPageInfo = null;

    if (linkHeader && linkHeader.includes('rel="next"')) {
      hasNextPage = true;
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        const nextUrl = new URL(nextMatch[1]);
        nextPageInfo = nextUrl.searchParams.get('page_info');
      }
    }

    res.json({
      success: true,
      products: productsWithSpecs,
      pagination: {
        currentPage: page,
        limit: limit,
        hasNextPage: hasNextPage,
        nextPageInfo: nextPageInfo
      }
    });

  } catch (error) {
    console.error('❌ Error fetching products:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      details: error.response?.data || error.message
    });
  }
});

// Get French translation for a specific metafield
app.get('/api/metafield/:id/french', async (req, res) => {
  try {
    const { id } = req.params;
    const shop = req.query.shop || SHOPIFY_SHOP;
    const accessToken = SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Missing shop or access token' });
    }

    console.log(`🔍 Getting French content for metafield ${id}`);

    // Get the original metafield
    const metafieldResponse = await axios.get(`https://${shop}/admin/api/2023-10/metafields/${id}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    const originalMetafield = metafieldResponse.data.metafield;
    const productId = originalMetafield.owner_id;

    // Try to get French translation using GraphQL with more detailed query
    const graphqlQuery = `
      query GetMetafieldTranslations($id: ID!) {
        metafield(id: $id) {
          id
          namespace
          key
          value
          translations(keys: ["value"], locales: [FR]) {
            locale
            key
            value
          }
        }
      }
    `;

    try {
      const graphqlResponse = await axios.post(`https://${shop}/admin/api/2023-10/graphql.json`, {
        query: graphqlQuery,
        variables: {
          id: `gid://shopify/Metafield/${id}`
        }
      }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

      console.log(`GraphQL Response:`, JSON.stringify(graphqlResponse.data, null, 2));

      const metafieldData = graphqlResponse.data.data?.metafield;
      if (metafieldData && metafieldData.translations && metafieldData.translations.length > 0) {
        console.log(`Found translations:`, metafieldData.translations);
        
        // Look for French translation for the 'value' key
        const frenchTranslation = metafieldData.translations.find(t => t.locale === 'FR' && t.key === 'value');
        
        if (frenchTranslation && frenchTranslation.value) {
          console.log(`✅ Found French translation via GraphQL`);
          console.log(`French content:`, frenchTranslation.value);
          
          // Return the French content
          return res.json({
            success: true,
            frenchContent: frenchTranslation.value
          });
        }
      }
    } catch (graphqlError) {
      console.log(`❌ GraphQL approach failed:`, graphqlError.response?.data || graphqlError.message);
    }

    // Fallback: Check for French metafield
    try {
      const allMetafieldsResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${productId}/metafields.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      });

      const allMetafields = allMetafieldsResponse.data.metafields;
      const frenchMetafield = allMetafields.find(m => m.namespace === 'custom' && m.key === 'specification_fr');
      
      if (frenchMetafield) {
        console.log(`✅ Found French metafield via REST API`);
        return res.json({
          success: true,
          frenchContent: frenchMetafield.value
        });
      }
    } catch (restError) {
      console.log(`❌ REST API approach failed:`, restError.response?.data || restError.message);
    }

    console.log(`❌ No French translation found for metafield ${id} - returning blank`);
    // Return success: true with empty content for blank display
    res.json({
      success: true,
      frenchContent: ''
    });

    } catch (error) {
    console.error('❌ Error getting French content:', error.response?.data || error.message);
    // Return success with empty content on error for blank display
    res.json({
      success: true,
      frenchContent: ''
    });
  }
});

// Translate metafield to French and fill French field
app.post('/api/translate-to-french', async (req, res) => {
  try {
    const { metafieldId, content, sourceLanguage } = req.body;
    const shop = req.query.shop || SHOPIFY_SHOP;
    const accessToken = SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Missing shop or access token' });
    }

    console.log(`🌍 Translating metafield ${metafieldId} to French...`);

    // Translate content to French
    const frenchContent = await translateJsonContent(content, sourceLanguage, 'fr');
    
    // Use GraphQL to register French translation
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

    const graphqlResponse = await axios.post(`https://${shop}/admin/api/2023-10/graphql.json`, {
      query: graphqlQuery,
      variables: {
        id: `gid://shopify/Metafield/${metafieldId}`,
      translations: [{
          locale: 'FR',
          key: 'value',
          value: JSON.stringify(frenchContent)
        }]
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (graphqlResponse.data.data?.translationsRegister?.userErrors?.length > 0) {
      console.error('❌ GraphQL translation errors:', graphqlResponse.data.data.translationsRegister.userErrors);
      return res.status(400).json({ 
        success: false,
        error: 'Translation failed',
        details: graphqlResponse.data.data.translationsRegister.userErrors
      });
    }

    console.log(`✅ Successfully translated metafield ${metafieldId} to French`);
      res.json({
        success: true,
      message: 'Translation completed successfully',
      frenchContent: frenchContent
    });

  } catch (error) {
    console.error('❌ Error translating to French:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to translate to French',
      details: error.response?.data || error.message
    });
  }
});

// Bulk translate all products
app.post('/api/bulk-translate-all', async (req, res) => {
  try {
    const shop = req.query.shop || SHOPIFY_SHOP;
    const accessToken = SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Missing shop or access token' });
    }

    console.log(`🚀 Starting bulk translation for shop: ${shop}`);

    // Set longer timeout for bulk operations
    res.setTimeout(300000); // 5 minutes

    let allProducts = [];
    let page = 1;
    let hasMorePages = true;

    // Fetch all products
    while (hasMorePages) {
      try {
        const response = await axios.get(`https://${shop}/admin/api/2023-10/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken
          },
          params: {
            limit: 250,
            page: page,
            fields: 'id,title,handle,metafields'
          }
        });

        const products = response.data.products;
        allProducts = allProducts.concat(products);

        // Check if there are more pages
        const linkHeader = response.headers.link;
        hasMorePages = linkHeader && linkHeader.includes('rel="next"');
        page++;

        console.log(`📦 Fetched page ${page - 1}: ${products.length} products (Total: ${allProducts.length})`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        hasMorePages = false;
      }
    }

    console.log(`📊 Total products to process: ${allProducts.length}`);

    // Process products in batches
    const batchSize = 5;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (product) => {
        try {
          // Get metafields for this product
          const metafieldsResponse = await axios.get(`https://${shop}/admin/api/2023-10/products/${product.id}/metafields.json`, {
            headers: {
              'X-Shopify-Access-Token': accessToken
            }
          });

          const metafields = metafieldsResponse.data.metafields;
          const specificationMetafield = metafields.find(m => m.namespace === 'custom' && m.key === 'specification');
          
          if (specificationMetafield) {
            const jsonContent = JSON.parse(specificationMetafield.value);
            const frenchContent = await translateJsonContent(jsonContent, 'en', 'fr');
            
            // Register French translation
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

            await axios.post(`https://${shop}/admin/api/2023-10/graphql.json`, {
              query: graphqlQuery,
              variables: {
                id: `gid://shopify/Metafield/${specificationMetafield.id}`,
                translations: [{
                  locale: 'FR',
                  key: 'value',
                  value: JSON.stringify(frenchContent)
                }]
        }
      }, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

            successCount++;
            console.log(`✅ Translated product ${product.title} (${successCount}/${allProducts.length})`);
          } else {
            console.log(`⏭️ Skipping product ${product.title} - no specification metafield`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error translating product ${product.title}:`, error.message);
        }
        
        processedCount++;
      }));

      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`🎉 Bulk translation completed! Success: ${successCount}, Errors: ${errorCount}`);
      res.json({
        success: true,
      message: 'Bulk translation completed',
      stats: {
        totalProducts: allProducts.length,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ Error in bulk translation:', error.response?.data || error.message);
      res.status(500).json({ 
      success: false,
      error: 'Bulk translation failed',
      details: error.response?.data || error.message
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 App available at: http://localhost:${PORT}`);
});