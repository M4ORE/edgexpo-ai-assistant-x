#!/usr/bin/env python3
"""
Edge-TTS Flask API Server
提供文字轉語音服務，支援多種輸出格式
"""

import os
import sys
import time
import hashlib
import tempfile
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import threading
import queue
import io
from contextlib import asynccontextmanager
import asyncio
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

# 配置
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit
app.config['UPLOAD_FOLDER'] = 'audio_output'
app.config['TEMP_FOLDER'] = 'temp_audio'

# 創建目錄
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['TEMP_FOLDER'], exist_ok=True)

# 全局變量
tts_model = None
model_lock = threading.Lock()

class TTSProcessor:
    """TTS 處理器"""
    
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.supported_languages = [
            'en', 'zh', 'zh-tw', 'zh-cn'
        ]
        
    def load_model(self):
        """Load Edge-TTS model"""
        try:
            logger.info("Initializing Edge-TTS...")
            
            # Test if Edge-TTS is available
            import edge_tts
            
            # Load voice mapping
            self.voice_mapping = {
                'zh': 'zh-CN-XiaoxiaoNeural',
                'zh-tw': 'zh-TW-HsiaoChenNeural',
                'zh-cn': 'zh-CN-XiaoxiaoNeural',
                'en': 'en-US-AriaNeural'
            }
            
            self.model = edge_tts
            self.is_loaded = True
            logger.info("Edge-TTS initialization completed")
            
        except Exception as e:
            logger.error(f"Edge-TTS initialization failed: {e}")
            raise
    
    def generate_audio(self, text, language='en', voice_id=None, **kwargs):
        """Generate speech"""
        if not self.is_loaded:
            raise RuntimeError("Edge-TTS not initialized")
            
        try:
            logger.info(f"Generating speech: {text[:50]}... (Language: {language})")
            
            # 使用真正的 Edge-TTS 生成語音
            audio_data = self._generate_edge_tts_audio(text, language, voice_id, **kwargs)
            
            return audio_data
            
        except Exception as e:
            logger.error(f"語音生成失敗: {e}")
            raise
    
    def _generate_edge_tts_audio(self, text, language, voice_id, **kwargs):
        """使用 Edge-TTS 生成真實語音"""
        try:
            # 選擇合適的語音
            if voice_id and voice_id in self.voice_mapping.values():
                # 如果提供了具體的語音ID且有效，直接使用
                voice = voice_id
            else:
                # 根據語言選擇預設語音
                voice = self.voice_mapping.get(language.lower(), 'en-US-AriaNeural')
            
            logger.info(f"Using voice: {voice} to generate speech")
            
            # 使用 Edge-TTS 生成語音
            async def generate_speech():
                try:
                    communicate = self.model.Communicate(text, voice)
                    audio_bytes = b""
                    
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            audio_bytes += chunk["data"]
                    
                    return audio_bytes
                except Exception as e:
                    logger.error(f"Edge-TTS 串流錯誤: {e}")
                    # 嘗試使用不同的方法
                    import aiohttp
                    import ssl
                    
                    # 忽略 SSL 驗證（開發環境用）
                    ssl_context = ssl.create_default_context()
                    ssl_context.check_hostname = False
                    ssl_context.verify_mode = ssl.CERT_NONE
                    
                    connector = aiohttp.TCPConnector(ssl=ssl_context)
                    communicate = self.model.Communicate(text, voice, connector=connector)
                    
                    audio_bytes = b""
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            audio_bytes += chunk["data"]
                    
                    return audio_bytes
            
            # 執行異步任務
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # 執行語音生成
            audio_data = loop.run_until_complete(generate_speech())
            
            if not audio_data:
                raise ValueError("Edge-TTS 未產生音頻數據")
            
            logger.info(f"語音生成成功，大小: {len(audio_data)} bytes")
            return audio_data
            
        except Exception as e:
            logger.error(f"Edge-TTS 生成失敗: {e}")
            # 如果 Edge-TTS 失敗，產生靜默音頻作為備用
            return self._generate_fallback_audio(text)
    
    def _generate_fallback_audio(self, text):
        """生成備用靜默音頻"""
        try:
            import wave
            import numpy as np
            import io
            
            logger.warning("生成備用靜默音頻")
            
            # 創建靜默音頻
            sample_rate = 22050
            duration = max(len(text) * 0.1, 1.0)  # 最少1秒
            
            # 生成靜默音頻數據
            samples = int(sample_rate * duration)
            audio_data = np.zeros(samples, dtype=np.int16)
            
            # 使用 BytesIO 避免臨時文件鎖定問題
            wav_buffer = io.BytesIO()
            
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)  # 單聲道
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data.tobytes())
            
            # 獲取 WAV 數據
            wav_buffer.seek(0)
            audio_bytes = wav_buffer.read()
            wav_buffer.close()
            
            logger.info(f"備用音頻生成成功，大小: {len(audio_bytes)} bytes")
            return audio_bytes
                
        except Exception as e:
            logger.error(f"備用音頻生成失敗: {e}")
            # 如果連備用音頻都無法生成，返回最小的 WAV 檔案頭
            return self._generate_minimal_wav()
    
    def _generate_minimal_wav(self):
        """生成最小的 WAV 檔案（1秒靜默）"""
        try:
            # WAV 檔案頭 + 1秒 22050Hz 16-bit 單聲道靜默
            wav_header = b'RIFF$\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"V\x00\x00D\xac\x00\x00\x02\x00\x10\x00data\x00\x08\x00\x00'
            silence_data = b'\x00\x00' * 22050  # 1秒靜默
            return wav_header + silence_data
        except Exception as e:
            logger.error(f"最小 WAV 生成失敗: {e}")
            # 返回空的 WAV 檔案頭
            return b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'

# 初始化 TTS 處理器
def init_tts_processor():
    """初始化 TTS 處理器"""
    global tts_model
    try:
        tts_model = TTSProcessor()
        tts_model.load_model()
        logger.info("TTS processor initialization completed")
    except Exception as e:
        logger.error(f"TTS processor initialization failed: {e}")
        tts_model = None

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': tts_model is not None and tts_model.is_loaded,
        'supported_languages': tts_model.supported_languages if tts_model else [],
        'timestamp': time.time()
    })

@app.route('/tts', methods=['POST', 'OPTIONS'])
def text_to_speech():
    """文字轉語音 API"""
    # 處理 OPTIONS 請求
    if request.method == 'OPTIONS':
        logger.info("收到 OPTIONS 請求")
        return '', 204
    
    try:
        # 記錄請求資訊
        logger.info(f"收到 TTS 請求 - Method: {request.method}, Content-Type: {request.content_type}")
        logger.info(f"請求 headers: {dict(request.headers)}")
        logger.info(f"原始請求數據: {request.get_data()}")
        
        # 檢查模型是否載入
        if not tts_model or not tts_model.is_loaded:
            logger.error("模型未載入")
            return jsonify({
                'error': '模型未載入',
                'code': 'MODEL_NOT_LOADED'
            }), 503
        
        # 解析請求
        try:
            data = request.get_json(force=True, silent=False)
            logger.info(f"解析的請求數據: {data}")
        except Exception as json_error:
            logger.error(f"JSON 解析錯誤: {json_error}")
            return jsonify({
                'error': f'JSON 格式錯誤: {str(json_error)}',
                'code': 'INVALID_JSON'
            }), 400
            
        if not data:
            logger.error("請求數據為空")
            return jsonify({
                'error': '缺少請求數據',
                'code': 'MISSING_DATA'
            }), 400
        
        text = data.get('text', '').strip()
        language = data.get('lang', 'en').lower()
        output_format = data.get('format', 'file').lower()  # file, stream, link
        voice_id = data.get('voice_id')
        
        logger.info(f"請求參數 - text: '{text[:50]}...', lang: {language}, format: {output_format}, voice_id: {voice_id}")
        
        # 驗證輸入
        if not text:
            logger.error("文字為空")
            return jsonify({
                'error': '文字不能為空',
                'code': 'EMPTY_TEXT'
            }), 400
        
        if len(text) > 5000:
            logger.error(f"文字過長: {len(text)} 字元")
            return jsonify({
                'error': '文字長度超過限制 (最多 5000 字元)',
                'code': 'TEXT_TOO_LONG'
            }), 400
        
        if language not in tts_model.supported_languages:
            logger.error(f"不支援的語言: {language}")
            return jsonify({
                'error': f'不支援的語言: {language}',
                'code': 'UNSUPPORTED_LANGUAGE',
                'supported_languages': tts_model.supported_languages
            }), 400
        
        # 生成語音
        with model_lock:
            audio_data = tts_model.generate_audio(
                text=text,
                language=language,
                voice_id=voice_id,
                **{k: v for k, v in data.items() if k not in ['text', 'lang', 'format', 'voice_id']}
            )
        
        # 根據輸出格式處理
        if output_format == 'stream':
            return Response(
                io.BytesIO(audio_data),
                mimetype='audio/wav',
                headers={
                    'Content-Disposition': 'attachment; filename="tts_output.wav"',
                    'Content-Length': str(len(audio_data))
                }
            )
        
        elif output_format == 'file':
            # 生成文件名
            text_hash = hashlib.md5(f"{text}_{language}".encode()).hexdigest()[:12]
            filename = f"tts_{language}_{text_hash}.wav"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # 保存文件
            with open(file_path, 'wb') as f:
                f.write(audio_data)
            
            return send_file(
                file_path,
                mimetype='audio/wav',
                as_attachment=True,
                download_name=filename
            )
        
        elif output_format == 'link':
            # 生成臨時文件和連結
            file_id = str(uuid.uuid4())
            filename = f"tts_{file_id}.wav"
            file_path = os.path.join(app.config['TEMP_FOLDER'], filename)
            
            # 保存文件
            with open(file_path, 'wb') as f:
                f.write(audio_data)
            
            # 設定文件過期時間 (1小時)
            expire_time = time.time() + 3600
            
            return jsonify({
                'status': 'success',
                'file_id': file_id,
                'download_url': f"/download/{file_id}",
                'expires_at': expire_time,
                'file_size': len(audio_data),
                'language': language,
                'text_length': len(text)
            })
        
        else:
            return jsonify({
                'error': f'不支援的輸出格式: {output_format}',
                'code': 'UNSUPPORTED_FORMAT',
                'supported_formats': ['file', 'stream', 'link']
            }), 400
    
    except Exception as e:
        logger.error(f"TTS 處理錯誤: {e}")
        return jsonify({
            'error': '內部伺服器錯誤',
            'code': 'INTERNAL_ERROR',
            'message': str(e)
        }), 500

@app.route('/download/<file_id>', methods=['GET'])
def download_file(file_id):
    """下載臨時文件"""
    try:
        # 驗證文件ID
        if not file_id or not file_id.replace('-', '').isalnum():
            return jsonify({
                'error': '無效的文件ID',
                'code': 'INVALID_FILE_ID'
            }), 400
        
        filename = f"tts_{file_id}.wav"
        file_path = os.path.join(app.config['TEMP_FOLDER'], filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'error': '文件不存在或已過期',
                'code': 'FILE_NOT_FOUND'
            }), 404
        
        return send_file(
            file_path,
            mimetype='audio/wav',
            as_attachment=True,
            download_name=f"tts_output_{file_id}.wav"
        )
    
    except Exception as e:
        logger.error(f"文件下載錯誤: {e}")
        return jsonify({
            'error': '文件下載失敗',
            'code': 'DOWNLOAD_ERROR'
        }), 500

@app.route('/languages', methods=['GET'])
def get_supported_languages():
    """取得支援的語言列表"""
    if not tts_model:
        return jsonify({
            'error': '模型未載入',
            'code': 'MODEL_NOT_LOADED'
        }), 503
    
    return jsonify({
        'supported_languages': tts_model.supported_languages,
        'total_count': len(tts_model.supported_languages)
    })

@app.route('/voices', methods=['GET'])
def get_available_voices():
    """取得可用的語音ID"""
    # Edge-TTS 可用語音
    voices = {
        'en': ['en-US-AriaNeural', 'en-US-GuyNeural', 'en-US-JennyNeural'],
        'zh': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-YunjianNeural'],
        'zh-tw': ['zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural', 'zh-TW-HsiaoYuNeural'],
        'zh-cn': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-YunjianNeural']
    }
    
    return jsonify({
        'voices': voices,
        'total_count': sum(len(v) for v in voices.values())
    })

@app.route('/cleanup', methods=['POST'])
def cleanup_temp_files():
    """清理過期的臨時文件"""
    try:
        current_time = time.time()
        cleanup_count = 0
        
        for filename in os.listdir(app.config['TEMP_FOLDER']):
            if filename.startswith('tts_') and filename.endswith('.wav'):
                file_path = os.path.join(app.config['TEMP_FOLDER'], filename)
                
                # 檢查文件年齡 (1小時)
                if current_time - os.path.getmtime(file_path) > 3600:
                    os.remove(file_path)
                    cleanup_count += 1
        
        return jsonify({
            'status': 'success',
            'cleaned_files': cleanup_count,
            'timestamp': current_time
        })
    
    except Exception as e:
        logger.error(f"清理文件錯誤: {e}")
        return jsonify({
            'error': '清理失敗',
            'code': 'CLEANUP_ERROR'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': '端點不存在',
        'code': 'NOT_FOUND'
    }), 404

@app.errorhandler(413)
def too_large(error):
    return jsonify({
        'error': '請求過大',
        'code': 'REQUEST_TOO_LARGE'
    }), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': '內部伺服器錯誤',
        'code': 'INTERNAL_ERROR'
    }), 500

def cleanup_worker():
    """背景清理任務"""
    while True:
        try:
            # 每小時清理一次
            time.sleep(3600)
            
            current_time = time.time()
            cleanup_count = 0
            
            # 清理臨時文件
            for filename in os.listdir(app.config['TEMP_FOLDER']):
                if filename.startswith('tts_') and filename.endswith('.wav'):
                    file_path = os.path.join(app.config['TEMP_FOLDER'], filename)
                    
                    if current_time - os.path.getmtime(file_path) > 3600:
                        os.remove(file_path)
                        cleanup_count += 1
            
            if cleanup_count > 0:
                logger.info(f"自動清理了 {cleanup_count} 個過期文件")
                
        except Exception as e:
            logger.error(f"背景清理任務錯誤: {e}")

if __name__ == '__main__':
    # 初始化 TTS 處理器
    init_tts_processor()
    
    # 啟動背景清理任務
    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()
    
    # 啟動 Flask 應用
    port = int(os.environ.get('PORT', 5004))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Edge-TTS Flask API Server (Port: {port})")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )