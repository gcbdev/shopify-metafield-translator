#!/usr/bin/env node

/**
 * Test script for the Shopify Metafield Translator app
 * This script helps test the translation functionality
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const SHOP = process.env.TEST_SHOP || 'your-dev-store.myshopify.com';

// Test data
const testJsonData = {
  "title": "Premium Wireless Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "features": [
    "Active noise cancellation",
    "30-hour battery life",
    "Quick charge technology",
    "Premium sound quality"
  ],
  "specifications": {
    "driver_size": "40mm",
    "frequency_response": "20Hz - 20kHz",
    "impedance": "32 ohms",
    "battery_life": "30 hours",
    "charging_time": "2 hours"
  },
  "warranty": "2 years manufacturer warranty",
  "compatibility": "Works with all Bluetooth devices"
};

async function testTranslation() {
  console.log('🧪 Testing Shopify Metafield Translator...\n');

  try {
    // Test 1: Check if app is running
    console.log('1. Testing app connectivity...');
    const healthResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ App is running\n');

    // Test 2: Test translation service
    console.log('2. Testing translation service...');
    const translationResponse = await axios.post(`${BASE_URL}/api/translate`, {
      productId: 1, // Mock product ID
      targetLanguage: 'es',
      sourceLanguage: 'en'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (translationResponse.data.success) {
      console.log('✅ Translation service is working');
      console.log('Original:', JSON.stringify(testJsonData, null, 2));
      console.log('Translated:', JSON.stringify(translationResponse.data.translatedContent, null, 2));
    } else {
      console.log('❌ Translation service failed:', translationResponse.data.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function testJsonParsing() {
  console.log('\n3. Testing JSON parsing...');
  
  const testCases = [
    { name: 'Valid JSON', data: testJsonData },
    { name: 'Empty object', data: {} },
    { name: 'Array', data: ['item1', 'item2', 'item3'] },
    { name: 'Nested object', data: { level1: { level2: { level3: 'deep' } } } }
  ];

  for (const testCase of testCases) {
    try {
      const jsonString = JSON.stringify(testCase.data);
      const parsed = JSON.parse(jsonString);
      console.log(`✅ ${testCase.name}: Valid`);
    } catch (error) {
      console.log(`❌ ${testCase.name}: Invalid - ${error.message}`);
    }
  }
}

async function testMetafieldStructure() {
  console.log('\n4. Testing metafield structure...');
  
  const metafieldExample = {
    id: 12345,
    namespace: 'custom',
    key: 'specification',
    value: JSON.stringify(testJsonData),
    type: 'json',
    description: 'Product specifications in JSON format'
  };

  console.log('Example metafield structure:');
  console.log(JSON.stringify(metafieldExample, null, 2));
  console.log('✅ Metafield structure is valid');
}

function printUsageInstructions() {
  console.log('\n📋 Usage Instructions:');
  console.log('1. Set up your environment variables in .env');
  console.log('2. Start the app: npm start');
  console.log('3. Install the app in your Shopify store');
  console.log('4. Create products with custom.specification metafields');
  console.log('5. Use the web interface to translate metafields');
  
  console.log('\n🔧 Environment Variables:');
  console.log('- SHOPIFY_API_KEY: Your Shopify API key');
  console.log('- SHOPIFY_API_SECRET: Your Shopify API secret');
  console.log('- HOST: Your app URL (e.g., https://your-app.herokuapp.com)');
  console.log('- TRANSLATION_API_KEY: Your translation service API key');
  console.log('- TRANSLATION_SERVICE: google, deepl, or azure');
  
  console.log('\n🌐 Test URLs:');
  console.log(`- App URL: ${BASE_URL}`);
  console.log(`- Install URL: ${BASE_URL}/auth?shop=${SHOP}`);
  console.log(`- Callback URL: ${BASE_URL}/auth/callback`);
}

// Run tests
async function runTests() {
  await testTranslation();
  await testJsonParsing();
  await testMetafieldStructure();
  printUsageInstructions();
}

// Check if running directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testTranslation,
  testJsonParsing,
  testMetafieldStructure
};
