"""
Flask-based Vercel function for Google Translate using googletrans
Removes translators-master fallback to avoid 401/crash issues
"""

import json
import asyncio
from flask import Flask, request, jsonify, make_response
from googletrans import Translator

app = Flask(__name__)


async def translate_text(text, source_lang='auto', target_lang='en'):
    try:
        async with Translator() as translator:
            result = await translator.translate(text, src=source_lang, dest=target_lang)
            return result.text
    except Exception as e:
        raise Exception(f"Translation error: {str(e)}")


async def translate_json_content(obj, source_lang='auto', target_lang='en'):
    if isinstance(obj, str):
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
            should_skip = any(skip_key in key.lower() for skip_key in skip_keys)
            if should_skip:
                translated[key] = value
            else:
                translated_key = key
                try:
                    translated_key = await translate_text(key, source_lang, target_lang)
                except:
                    pass
                translated[translated_key] = await translate_json_content(value, source_lang, target_lang)

        return translated
    else:
        return obj


def _cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp


@app.route('/', methods=['GET', 'POST', 'OPTIONS'])
def http_handler():
    if request.method == 'OPTIONS':
        return _cors(make_response('', 200))

    if request.method == 'GET':
        return _cors(make_response(jsonify({
            'status': 'ok',
            'service': 'googletrans-api',
            'message': 'Google Translate API is running'
        }), 200))

    # POST
    try:
        data = request.get_json(silent=True) or {}

        text = data.get('text')
        source_lang = data.get('sourceLanguage', 'auto')
        target_lang = data.get('targetLanguage', 'en')
        is_json = data.get('isJson', False)
        json_content = data.get('jsonContent')

        if not text and json_content is None:
            return _cors(make_response(jsonify({
                'success': False,
                'error': 'Missing text or jsonContent'
            }), 400))

        if is_json and json_content is not None:
            result = asyncio.run(translate_json_content(json_content, source_lang, target_lang))
        elif json_content is not None:
            parsed_json = json.loads(json_content) if isinstance(json_content, str) else json_content
            result = asyncio.run(translate_json_content(parsed_json, source_lang, target_lang))
        else:
            result = asyncio.run(translate_text(text, source_lang, target_lang))

        return _cors(make_response(jsonify({
            'success': True,
            'translated': result,
            'sourceLanguage': source_lang,
            'targetLanguage': target_lang
        }), 200))
    except json.JSONDecodeError:
        return _cors(make_response(jsonify({
            'success': False,
            'error': 'Invalid JSON in request body'
        }), 400))
    except Exception as e:
        return _cors(make_response(jsonify({
            'success': False,
            'error': f'Translation failed: {str(e)}'
        }), 500))


# No extra handler needed; Vercel detects the Flask WSGI app via module-level `app`
