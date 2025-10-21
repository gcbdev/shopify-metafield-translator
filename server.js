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

// Simple authentication middleware
const authenticateShopify = async (req, res, next) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // For now, we'll use a mock approach since we don't have OAuth set up
    req.shop = shop;
    req.apiKey = process.env.SHOPIFY_API_KEY;
    req.apiSecret = process.env.SHOPIFY_API_SECRET;
    
    // Mock authentication for testing
    req.isAuthenticated = true;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Mock products API for testing (will be replaced with real Shopify API)
app.get('/api/products', authenticateShopify, async (req, res) => {
  try {
    const shop = req.shop;
    
    // Mock products that simulate your real products with custom.specification metafields
    const mockProducts = [
      {
        id: 1,
        title: "Professional Camera Stand",
        handle: "professional-camera-stand",
        metafields: [
          {
            id: 101,
            namespace: "custom",
            key: "specification",
            value: JSON.stringify({
              "General specifications": {
                "Type": ["Stand"],
                "Contents": ["Light stand with leveling leg"],
                "Overview": ["Black chrome plated steel stand"]
              },
              "Stand properties": {
                "Height / Length": ["10.3 '"],
                "Collapsed Height": ["48.03 ''"],
                "Fitting": ["type 14 attachment type"],
                "Weight": ["6.61 lbs"],
                "Other specs": ["Footprint - maximum diameter: 46.46''<br>Load capacity: 26.46 lbs<br>Load capacity at maximum extension: 5.51 lbs<br>Suggested wheels: 109, 110, 110G"]
              },
              "Hidden": {
                "Compatibility": ["Manfrotto 110 Wheels", "Manfrotto 110G Wheels", "Manfrotto 109 Wheels"],
                "Brand": ["Manfrotto"]
              }
            })
          }
        ]
      },
      {
        id: 2,
        title: "Wireless Headphones Pro",
        handle: "wireless-headphones-pro",
        metafields: [
          {
            id: 102,
            namespace: "custom",
            key: "specification",
            value: JSON.stringify({
              "Audio specifications": {
                "Driver Type": ["Dynamic"],
                "Frequency Response": ["20Hz - 20kHz"],
                "Impedance": ["32 ohms"],
                "Sensitivity": ["105 dB"]
              },
              "Connectivity": {
                "Bluetooth Version": ["5.0"],
                "Range": ["30 feet"],
                "Battery Life": ["30 hours"],
                "Charging Time": ["2 hours"]
              },
              "Features": {
                "Noise Cancellation": ["Active"],
                "Water Resistance": ["IPX4"],
                "Controls": ["Touch controls", "Voice assistant"]
              }
            })
          }
        ]
      },
      {
        id: 3,
        title: "Smart Fitness Watch",
        handle: "smart-fitness-watch",
        metafields: [
          {
            id: 103,
            namespace: "custom",
            key: "specification",
            value: JSON.stringify({
              "Display": {
                "Screen Size": ["1.4 inch"],
                "Resolution": ["454 x 454 pixels"],
                "Type": ["AMOLED"],
                "Brightness": ["1000 nits"]
              },
              "Health Monitoring": {
                "Heart Rate": ["Continuous monitoring"],
                "Blood Oxygen": ["SpO2 tracking"],
                "Sleep Tracking": ["Advanced sleep stages"],
                "Stress Monitoring": ["Real-time stress levels"]
              },
              "Fitness Features": {
                "GPS": ["Built-in GPS"],
                "Water Resistance": ["5ATM"],
                "Battery Life": ["7 days"],
                "Workout Modes": ["50+ sports modes"]
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
      message: `Demo Mode: Showing ${mockProducts.length} sample products with custom.specification metafields. Connect to ${shop} for real products.`
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

// Install route for your store
app.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) {
    return res.status(400).send('Shop parameter is required');
  }

  // Redirect to main app with shop parameter
  res.redirect(`/?shop=${shop}`);
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

// Mock metafield API for testing
app.get('/api/product/:id/metafield', authenticateShopify, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock metafield data based on product ID
    const mockMetafields = {
      1: {
        id: 101,
        namespace: "custom",
        key: "specification",
        value: JSON.stringify({
          "General specifications": {
            "Type": ["Stand"],
            "Contents": ["Light stand with leveling leg"],
            "Overview": ["Black chrome plated steel stand"]
          },
          "Stand properties": {
            "Height / Length": ["10.3 '"],
            "Collapsed Height": ["48.03 ''"],
            "Fitting": ["type 14 attachment type"],
            "Weight": ["6.61 lbs"],
            "Other specs": ["Footprint - maximum diameter: 46.46''<br>Load capacity: 26.46 lbs<br>Load capacity at maximum extension: 5.51 lbs<br>Suggested wheels: 109, 110, 110G"]
          },
          "Hidden": {
            "Compatibility": ["Manfrotto 110 Wheels", "Manfrotto 110G Wheels", "Manfrotto 109 Wheels"],
            "Brand": ["Manfrotto"]
          }
        })
      },
      2: {
        id: 102,
        namespace: "custom",
        key: "specification",
        value: JSON.stringify({
          "Audio specifications": {
            "Driver Type": ["Dynamic"],
            "Frequency Response": ["20Hz - 20kHz"],
            "Impedance": ["32 ohms"],
            "Sensitivity": ["105 dB"]
          },
          "Connectivity": {
            "Bluetooth Version": ["5.0"],
            "Range": ["30 feet"],
            "Battery Life": ["30 hours"],
            "Charging Time": ["2 hours"]
          },
          "Features": {
            "Noise Cancellation": ["Active"],
            "Water Resistance": ["IPX4"],
            "Controls": ["Touch controls", "Voice assistant"]
          }
        })
      },
      3: {
        id: 103,
        namespace: "custom",
        key: "specification",
        value: JSON.stringify({
          "Display": {
            "Screen Size": ["1.4 inch"],
            "Resolution": ["454 x 454 pixels"],
            "Type": ["AMOLED"],
            "Brightness": ["1000 nits"]
          },
          "Health Monitoring": {
            "Heart Rate": ["Continuous monitoring"],
            "Blood Oxygen": ["SpO2 tracking"],
            "Sleep Tracking": ["Advanced sleep stages"],
            "Stress Monitoring": ["Real-time stress levels"]
          },
          "Fitness Features": {
            "GPS": ["Built-in GPS"],
            "Water Resistance": ["5ATM"],
            "Battery Life": ["7 days"],
            "Workout Modes": ["50+ sports modes"]
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
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield?shop=${req.query.shop}`);
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
    const metafieldResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/product/${productId}/metafield?shop=${req.query.shop}`);
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

// Mock metafield update for testing
app.put('/api/metafield/:id', authenticateShopify, async (req, res) => {
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
      },
      message: 'Metafield updated successfully! (Demo Mode - Translation completed)'
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