/**
 * Quick test script to verify Yandex API credentials
 * Run with: node test-yandex.js
 */

const axios = require('axios');

const YANDEX_API_KEY = 'AQVNytwIR5D0Njp54CNXOaTQ-J3qQkj2lcLpc6Bu';
const YANDEX_FOLDER_ID = 'b1gn8gj1pk8hilk34vt1';

async function testYandexAPI() {
  console.log('🔍 Testing Yandex Translate API connection...\n');
  
  try {
    const response = await axios.post(
      'https://translate.api.cloud.yandex.net/translate/v2/translate',
      {
        folderId: YANDEX_FOLDER_ID,
        texts: ['Hello, world!'],
        targetLanguageCode: 'fr'
      },
      {
        headers: {
          'Authorization': `Api-Key ${YANDEX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );
    
    if (response.data && response.data.translations && response.data.translations.length > 0) {
      const translated = response.data.translations[0].text;
      console.log('✅ Yandex API test SUCCESSFUL!');
      console.log(`   Original: "Hello, world!"`);
      console.log(`   French:   "${translated}"`);
      console.log('\n✅ Your Yandex credentials are working correctly!');
      console.log('\n📝 Next steps:');
      console.log('   1. Add these to your .env file or Vercel environment variables');
      console.log('   2. Restart your server');
      console.log('   3. Try translating a product metafield');
      return true;
    } else {
      console.error('❌ Unexpected response format:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Yandex API test FAILED!');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error:`, error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n💡 Issue: Authentication failed - check your API key');
      } else if (error.response.status === 403) {
        console.error('\n💡 Issue: Permission denied - check folder ID and service account permissions');
      } else if (error.response.status === 400) {
        console.error('\n💡 Issue: Bad request - check folder ID format');
      }
    } else {
      console.error('   Error:', error.message);
      console.error('\n💡 Issue: Network error or timeout');
    }
    return false;
  }
}

// Run test
testYandexAPI().then(success => {
  process.exit(success ? 0 : 1);
});

