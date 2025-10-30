"""
Vercel serverless function for Google Translate using googletrans library
This provides a more reliable translation service than direct HTTP calls
"""

import json
import asyncio
from googletrans import Translator


async def translate_text(text, source_lang='auto', target_lang='en'):
    """Translate text using googletrans"""
    try:
        async with Translator() as translator:
            result = await translator.translate(text, src=source_lang, dest=target_lang)
            return result.text
    except Exception as e:
        raise Exception(f"Translation error: {str(e)}")


async def translate_json_content(obj, source_lang='auto', target_lang='en'):
    """Recursively translate JSON object"""
    if isinstance(obj, str):
        # Skip very short strings or numbers
        if len(obj) < 3 or obj.isdigit():
            return obj
        return await translate_text(obj, source_lang, target_lang)
    elif isinstance(obj, list):
        return [await translate_json_content(item, source_lang, target_lang) for item in obj]
    elif isinstance(obj, dict):
        translated = {}
        skip_keys = ['id', 'sku', 'barcode', 'ean', 'upc', 'isbn', 'asin', 'url', 'link', 
                    'image', 'images', 'video', 'videos', 'price', 'cost', 'weight', 
                    'dimensions', 'size', 'color_code', 'hex', 'rgb', 'hsl', 'date', 
                    'time', 'timestamp', 'created_at', 'updated_at', 'status', 'type', 
                    'category', 'tags', 'keywords']
        
        for key, value in obj.items():
            # Check if key should be skipped
            should_skip = any(skip_key in key.lower() for skip_key in skip_keys)
            
            if should_skip:
                translated[key] = value
            else:
                # Translate key
                translated_key = key
                try:
                    translated_key = await translate_text(key, source_lang, target_lang)
                except:
                    pass  # Keep original if translation fails
                
                # Translate value
                translated[translated_key] = await translate_json_content(value, source_lang, target_lang)
        
        return translated
    else:
        return obj


def handler(req):
    """Vercel serverless function handler"""
    # Get method from request
    method = req.get('method', 'GET')
    body = req.get('body', '{}')
    headers = req.get('headers', {})
    
    # Handle CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    # Handle GET (health check)
    if method == 'GET':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'ok',
                'service': 'googletrans-api',
                'message': 'Google Translate API is running'
            })
        }
    
    # Handle POST (translation)
    try:
        # Parse request body
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = body if body else {}
        
        text = data.get('text')
        source_lang = data.get('sourceLanguage', 'auto')
        target_lang = data.get('targetLanguage', 'en')
        is_json = data.get('isJson', False)
        json_content = data.get('jsonContent')
        
        if not text and not json_content:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing text or jsonContent'
                })
            }
        
        # Run async translation
        result = None
        if is_json and json_content:
            # Translate JSON object
            result = asyncio.run(translate_json_content(json_content, source_lang, target_lang))
        elif json_content:
            # JSON content as string
            parsed_json = json.loads(json_content) if isinstance(json_content, str) else json_content
            result = asyncio.run(translate_json_content(parsed_json, source_lang, target_lang))
        else:
            # Simple text translation
            result = asyncio.run(translate_text(text, source_lang, target_lang))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'translated': result,
                'sourceLanguage': source_lang,
                'targetLanguage': target_lang
            })
        }
        
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': 'Invalid JSON in request body'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': f'Translation failed: {str(e)}'
            })
        }


# Export default handler for Vercel
default = handler

