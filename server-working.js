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

// Simple test route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'install.html'));
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'App is running',
    timestamp: new Date().toISOString()
  });
});

// Mock API routes for testing
app.get('/api/products', (req, res) => {
  // Mock products with metafields for testing
  const mockProducts = [
    {
      id: 1,
      title: "Wireless Headphones",
      handle: "wireless-headphones",
      metafields: [
        {
          id: 101,
          namespace: "custom",
          key: "specification",
          value: JSON.stringify({
            "title": "Premium Wireless Headphones",
            "description": "High-quality wireless headphones with noise cancellation",
            "features": [
              "Active noise cancellation",
              "30-hour battery life",
              "Quick charge technology"
            ],
            "specifications": {
              "driver_size": "40mm",
              "frequency_response": "20Hz - 20kHz",
              "impedance": "32 ohms"
            }
          })
        }
      ]
    },
    {
      id: 2,
      title: "Smart Watch",
      handle: "smart-watch",
      metafields: [
        {
          id: 102,
          namespace: "custom",
          key: "specification",
          value: JSON.stringify({
            "title": "Smart Fitness Watch",
            "description": "Track your fitness and stay connected",
            "features": [
              "Heart rate monitoring",
              "GPS tracking",
              "Water resistant",
              "7-day battery life"
            ],
            "specifications": {
              "display": "1.4 inch AMOLED",
              "battery": "7 days",
              "water_resistance": "5ATM"
            }
          })
        }
      ]
    }
  ];

  res.json({
    success: true,
    products: mockProducts,
    total: mockProducts.length,
    limit: 500,
    page: 1,
    hasNextPage: false,
    message: `Found ${mockProducts.length} products with custom.specification metafields. Showing page 1 with 500 products per page.`
  });
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

// Get specific product metafield
app.get('/api/product/:id/metafield', (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock metafield data based on product ID
    const mockMetafields = {
      1: {
        id: 101,
        namespace: "custom",
        key: "specification",
        value: JSON.stringify({
          "title": "Premium Wireless Headphones",
          "description": "High-quality wireless headphones with noise cancellation",
          "features": [
            "Active noise cancellation",
            "30-hour battery life",
            "Quick charge technology"
          ],
          "specifications": {
            "driver_size": "40mm",
            "frequency_response": "20Hz - 20kHz",
            "impedance": "32 ohms"
          }
        })
      },
      2: {
        id: 102,
        namespace: "custom",
        key: "specification",
        value: JSON.stringify({
          "title": "Smart Fitness Watch",
          "description": "Track your fitness and stay connected",
          "features": [
            "Heart rate monitoring",
            "GPS tracking",
            "Water resistant",
            "7-day battery life"
          ],
          "specifications": {
            "display": "1.4 inch AMOLED",
            "battery": "7 days",
            "water_resistance": "5ATM"
          }
        })
      }
    };

    const metafield = mockMetafields[id] || null;

    res.json({
      success: true,
      metafield: metafield
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
      message: 'This is a test translation. Click "Save Translation" to apply it to the product.'
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

// Update metafield API endpoint (mock)
app.put('/api/metafield/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { translatedContent } = req.body;

    if (!translatedContent) {
      return res.status(400).json({ error: 'Translated content is required' });
    }

    // Mock successful update
    res.json({
      success: true,
      metafield: {
        id: id,
        value: JSON.stringify(translatedContent)
      }
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
