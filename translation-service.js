const axios = require('axios');

class TranslationService {
  constructor(apiKey, service = 'google') {
    this.apiKey = apiKey;
    this.service = service;
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    try {
      switch (this.service) {
        case 'google':
          return await this.translateWithGoogle(text, sourceLanguage, targetLanguage);
        case 'deepl':
          return await this.translateWithDeepL(text, sourceLanguage, targetLanguage);
        case 'azure':
          return await this.translateWithAzure(text, sourceLanguage, targetLanguage);
        case 'mymemory':
          return await this.translateWithMyMemory(text, sourceLanguage, targetLanguage);
        default:
          return await this.translateWithMyMemory(text, sourceLanguage, targetLanguage);
      }
    } catch (error) {
      console.error('Translation error:', error);
      return this.mockTranslation(text, targetLanguage);
    }
  }

  async translateWithGoogle(text, sourceLanguage, targetLanguage) {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`,
      {
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      }
    );

    return response.data.data.translations[0].translatedText;
  }

  async translateWithDeepL(text, sourceLanguage, targetLanguage) {
    const response = await axios.post(
      'https://api-free.deepl.com/v2/translate',
      {
        text: [text],
        source_lang: sourceLanguage.toUpperCase(),
        target_lang: targetLanguage.toUpperCase()
      },
      {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.translations[0].text;
  }

  async translateWithAzure(text, sourceLanguage, targetLanguage) {
    const endpoint = 'https://api.cognitive.microsofttranslator.com';
    const location = 'global';
    
    const response = await axios.post(
      `${endpoint}/translate?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`,
      [{ text }],
      {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Ocp-Apim-Subscription-Region': location,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data[0].translations[0].text;
  }

  async translateWithMyMemory(text, sourceLanguage, targetLanguage) {
    // MyMemory API is free and doesn't require an API key
    const response = await axios.get(
      `https://api.mymemory.translated.net/get`,
      {
        params: {
          q: text,
          langpair: `${sourceLanguage}|${targetLanguage}`
        }
      }
    );

    if (response.data.responseStatus === 200) {
      return response.data.responseData.translatedText;
    } else {
      throw new Error('MyMemory translation failed');
    }
  }

  mockTranslation(text, targetLanguage) {
    // Fallback mock translation for testing
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }

  async translateJsonObject(obj, sourceLanguage, targetLanguage) {
    if (typeof obj === 'string') {
      return await this.translateText(obj, sourceLanguage, targetLanguage);
    } else if (Array.isArray(obj)) {
      return await Promise.all(
        obj.map(item => this.translateJsonObject(item, sourceLanguage, targetLanguage))
      );
    } else if (obj && typeof obj === 'object') {
      const translated = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip translation for certain keys that shouldn't be translated
        if (this.shouldSkipTranslation(key)) {
          translated[key] = value;
        } else {
          translated[key] = await this.translateJsonObject(value, sourceLanguage, targetLanguage);
        }
      }
      return translated;
    }
    return obj;
  }

  shouldSkipTranslation(key) {
    // Keys that typically shouldn't be translated
    const skipKeys = [
      'id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin',
      'url', 'link', 'image', 'images', 'video', 'videos',
      'price', 'cost', 'weight', 'dimensions', 'size',
      'color_code', 'hex', 'rgb', 'hsl',
      'date', 'time', 'timestamp', 'created_at', 'updated_at',
      'status', 'type', 'category', 'tags', 'keywords'
    ];
    
    return skipKeys.some(skipKey => 
      key.toLowerCase().includes(skipKey.toLowerCase())
    );
  }
}

module.exports = TranslationService;
