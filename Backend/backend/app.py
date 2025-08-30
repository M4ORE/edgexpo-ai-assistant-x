from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import logging
import asyncio
from pathlib import Path
import sys

# 添加當前目錄到Python路徑
sys.path.append(str(Path(__file__).parent.parent))

from backend.config import Config, ModelConfig, LogConfig, ServiceConfig
from backend.utils.logger import setup_logger
from backend.services.microservice_client import STTServiceClient, TTSServiceClient, EmbeddingServiceClient, LLMServiceClient

# 初始化Flask應用
app = Flask(__name__)
app.config.from_object(Config)

# 配置CORS
CORS(app, origins=Config.CORS_ORIGINS.split(','))

# 配置SocketIO
socketio = SocketIO(app, cors_allowed_origins=Config.CORS_ORIGINS.split(','))

# 設置日誌
logger = setup_logger(__name__)

# 初始化微服務客戶端
stt_client = STTServiceClient(ServiceConfig.STT_SERVICE_URL)
tts_client = TTSServiceClient(ServiceConfig.TTS_SERVICE_URL)
embedding_client = EmbeddingServiceClient(ServiceConfig.EMBEDDING_SERVICE_URL)
llm_client = LLMServiceClient(ServiceConfig.LLM_SERVICE_URL, ServiceConfig.LLM_API_KEY)

# 服務狀態
rag_service = None  # 延遲載入微服務RAG
crm_service = None  # CRM服務

def init_services():
    """應用啟動時預載入所有服務"""
    global rag_service
    logger.info("開始預載入微服務RAG服務...")
    get_rag_service()  # 預載入RAG服務
    logger.info("微服務RAG服務預載入完成")


def get_rag_service():
    global rag_service
    if rag_service is None:
        from backend.services.microservice_rag_service import MicroserviceRAGService
        rag_service = MicroserviceRAGService()
    return rag_service

def get_crm_service():
    global crm_service
    if crm_service is None:
        from backend.services.crm_service import CRMService
        crm_service = CRMService()
    return crm_service




# 健康檢查端點 (使用微服務)
@app.route('/api/health', methods=['GET'])
def health_check():
    # 檢查微服務狀態
    services_health = {}
    
    # 檢查STT微服務
    stt_health = stt_client.check_health()
    services_health['stt'] = stt_health.get('status') == 'healthy'
    
    # 檢查TTS微服務  
    tts_health = tts_client.check_health()
    services_health['tts'] = tts_health.get('status') == 'healthy'
    
    # 檢查Embedding微服務
    embedding_health = embedding_client.check_health()
    services_health['embedding'] = embedding_health.get('status') == 'healthy'
    
    # 檢查LLM微服務
    llm_health = llm_client.check_health()
    services_health['llm'] = llm_health.get('status') == 'healthy'
    
    # RAG服務狀態 (現在使用微服務架構)
    services_health['rag'] = rag_service is not None and services_health['embedding'] and services_health['llm']
    
    # CRM服務狀態 (保持不變)
    services_health['crm'] = crm_service is not None
    
    # 計算整體狀態
    core_microservices_ready = (services_health['stt'] and services_health['tts'] and 
                               services_health['embedding'] and services_health['llm'])
    overall_status = 'healthy' if core_microservices_ready else 'partial'
    
    return jsonify({
        'status': overall_status,
        'version': '1.0.0',
        'services': services_health,
        'microservices': {
            'stt': stt_health,
            'tts': tts_health,
            'embedding': embedding_health,
            'llm': llm_health
        },
        'config': {
            'stt_service_url': ServiceConfig.STT_SERVICE_URL,
            'tts_service_url': ServiceConfig.TTS_SERVICE_URL,
            'embedding_service_url': ServiceConfig.EMBEDDING_SERVICE_URL,
            'llm_service_url': ServiceConfig.LLM_SERVICE_URL
        }
    })

# POC 系統健康檢查端點 (符合 POC 規格，使用微服務)
@app.route('/api/v1/system/health', methods=['GET'])
def poc_health_check():
    """POC 規格的系統健康檢查"""
    try:
        # 檢查微服務狀態
        stt_health = stt_client.check_health()
        tts_health = tts_client.check_health()
        embedding_health = embedding_client.check_health()
        llm_health = llm_client.check_health()
        
        # 檢查各服務狀態 (POC格式)
        services_status = {
            'whisper': 'ready' if stt_health.get('status') == 'healthy' else 'not_ready',
            'llm': 'ready' if (embedding_health.get('status') == 'healthy' and 
                              llm_health.get('status') == 'healthy' and
                              rag_service is not None) else 'not_ready',
            'tts': 'ready' if tts_health.get('status') == 'healthy' else 'not_ready'
        }
        
        # 判斷整體狀態
        all_ready = all(status == 'ready' for status in services_status.values())
        
        return jsonify({
            'status': 'healthy' if all_ready else 'partial',
            'services': services_status
        }), 200
        
    except Exception as e:
        logger.error(f"健康檢查錯誤: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500


# ASR端點 (使用STT微服務)
@app.route('/api/asr', methods=['POST'])
def speech_to_text():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '未找到音頻檔案'}), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'zh-TW')
        
        # 儲存臨時檔案
        temp_path = Config.UPLOAD_FOLDER / f"temp_audio_{audio_file.filename}"
        audio_file.save(str(temp_path))
        
        # 檢查並轉換音頻格式 (如果需要)
        converted_path = temp_path
        if temp_path.suffix.lower() in ['.webm', '.ogg']:
            # 轉換為wav格式
            converted_path = temp_path.with_suffix('.wav')
            
            # 嘗試使用不同的ffmpeg路徑
            ffmpeg_paths = [
                'ffmpeg',  # 系統PATH中的ffmpeg
                str(Path(__file__).parent.parent / 'service-stt' / 'ffmpeg' / 'bin' / 'ffmpeg.exe'),  # service-stt中的ffmpeg
                'C:\\ffmpeg\\bin\\ffmpeg.exe',  # 常見安裝路徑
            ]
            
            conversion_success = False
            for ffmpeg_path in ffmpeg_paths:
                try:
                    import subprocess
                    subprocess.run([
                        ffmpeg_path, '-i', str(temp_path), 
                        '-acodec', 'pcm_s16le', '-ar', '16000', '-y',  # 添加-y自動覆蓋
                        str(converted_path)
                    ], check=True, capture_output=True)
                    
                    # 轉換成功，刪除原始文件
                    temp_path.unlink(missing_ok=True)
                    conversion_success = True
                    logger.info(f"音頻轉換成功: {temp_path} -> {converted_path}")
                    break
                    
                except (subprocess.CalledProcessError, FileNotFoundError) as e:
                    continue  # 嘗試下一個路徑
            
            if not conversion_success:
                logger.warning("所有ffmpeg路徑都失敗，嘗試直接使用原始格式")
                converted_path = temp_path
        
        # 調用STT微服務
        text = stt_client.transcribe(str(converted_path), language=language)
        
        # 清理轉換後的臨時文件
        converted_path.unlink(missing_ok=True)
        
        return jsonify({
            'text': text,
            'language': language
        })
        
    except Exception as e:
        logger.error(f"ASR錯誤: {str(e)}")
        # 清理臨時檔案（如果存在）
        try:
            if 'temp_path' in locals():
                temp_path.unlink(missing_ok=True)
            if 'converted_path' in locals() and converted_path != temp_path:
                converted_path.unlink(missing_ok=True)
        except:
            pass
        
        # 處理不同類型的錯誤
        if "STT服務暫時不可用" in str(e):
            return jsonify({'error': 'STT服務暫時不可用，請稍後再試'}), 503
        else:
            return jsonify({'error': str(e)}), 500

# TTS端點 (使用TTS微服務)
@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'zh-TW')
        
        if not text:
            return jsonify({'error': '文字內容不能為空'}), 400
        
        # 調用TTS微服務
        audio_path = tts_client.synthesize(text, language)
        
        # 返回音頻檔案
        return send_from_directory(
            directory=Path(audio_path).parent,
            path=Path(audio_path).name,
            mimetype='audio/wav'
        )
        
    except Exception as e:
        logger.error(f"TTS錯誤: {str(e)}")
        
        # 處理不同類型的錯誤
        if "TTS服務暫時不可用" in str(e):
            return jsonify({'error': 'TTS服務暫時不可用，請稍後再試'}), 503
        else:
            return jsonify({'error': str(e)}), 500

# TTS 語言和語音列表端點 (使用TTS微服務)
@app.route('/api/tts/languages', methods=['GET'])
def get_tts_languages():
    try:
        languages = tts_client.get_available_languages()
        return jsonify({'languages': languages})
    except Exception as e:
        logger.error(f"獲取TTS語言列表錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts/voices', methods=['GET'])
def get_tts_voices():
    try:
        voices = tts_client.get_available_voices()
        return jsonify({'voices': voices})
    except Exception as e:
        logger.error(f"獲取TTS語音列表錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

# RAG查詢端點
@app.route('/api/rag', methods=['POST'])
def rag_query():
    try:
        data = request.get_json()
        query = data.get('query', '')
        language = data.get('language', 'zh-TW')
        
        if not query:
            return jsonify({'error': '查詢內容不能為空'}), 400
        
        # 執行RAG查詢
        service = get_rag_service()
        response = service.query(query, language)
        
        return jsonify({
            'response': response,
            'query': query,
            'language': language
        })
        
    except Exception as e:
        logger.error(f"RAG錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 知識庫管理端點
@app.route('/api/kb/list', methods=['GET'])
def list_knowledge_base():
    try:
        service = get_rag_service()
        items = service.list_knowledge_items()
        return jsonify({'items': items})
    except Exception as e:
        logger.error(f"知識庫列表錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/kb/update', methods=['POST'])
def update_knowledge_base():
    try:
        data = request.get_json()
        item_id = data.get('id')
        content = data.get('content')
        category = data.get('category', 'general')
        
        service = get_rag_service()
        success = service.update_knowledge_item(item_id, content, category)
        
        if success:
            return jsonify({'message': '更新成功'})
        else:
            return jsonify({'error': '更新失敗'}), 400
            
    except Exception as e:
        logger.error(f"知識庫更新錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/kb/delete', methods=['DELETE'])
def delete_knowledge_item():
    try:
        item_id = request.args.get('id')
        if not item_id:
            return jsonify({'error': '需要提供項目ID'}), 400
        
        service = get_rag_service()
        success = service.delete_knowledge_item(item_id)
        
        if success:
            return jsonify({'message': '刪除成功'})
        else:
            return jsonify({'error': '刪除失敗'}), 400
            
    except Exception as e:
        logger.error(f"知識庫刪除錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ==================== CRM API ====================

# 1. 建立聯絡人
@app.route('/api/crm/contacts', methods=['POST'])
def create_contact():
    try:
        data = request.get_json()
        
        service = get_crm_service()
        contact = service.create_contact(data)
        
        return jsonify({
            'contact_id': contact.contact_id,
            'status': 'created'
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"建立聯絡人錯誤: {str(e)}")
        return jsonify({'error': '建立聯絡人失敗'}), 500

# 2. 聯絡人清單
@app.route('/api/crm/contacts', methods=['GET'])
def list_contacts():
    try:
        limit = int(request.args.get('limit', 10))
        offset = int(request.args.get('offset', 0))
        
        service = get_crm_service()
        result = service.list_contacts(limit=limit, offset=offset)
        
        contacts = []
        for contact_data in result['contacts']:
            contacts.append({
                'contact_id': contact_data['contact_id'],
                'name': contact_data['name'],
                'company': contact_data['company'],
                'created_at': contact_data['created_at']
            })
        
        return jsonify({
            'contacts': contacts,
            'total': result['total']
        }), 200
        
    except Exception as e:
        logger.error(f"列出聯絡人錯誤: {str(e)}")
        return jsonify({'error': '無法取得聯絡人清單'}), 500

# 3. 取得單一聯絡人
@app.route('/api/crm/contacts/<contact_id>', methods=['GET'])
def get_contact(contact_id):
    try:
        service = get_crm_service()
        contact = service.get_contact(contact_id)
        
        if contact:
            return jsonify(contact.to_dict()), 200
        else:
            return jsonify({'error': '聯絡人不存在'}), 404
            
    except Exception as e:
        logger.error(f"取得聯絡人錯誤: {str(e)}")
        return jsonify({'error': '無法取得聯絡人資訊'}), 500

# 4. 更新聯絡人
@app.route('/api/crm/contacts/<contact_id>', methods=['PUT'])
def update_contact(contact_id):
    try:
        data = request.get_json()
        
        service = get_crm_service()
        contact = service.update_contact(contact_id, data)
        
        if contact:
            return jsonify(contact.to_dict()), 200
        else:
            return jsonify({'error': '聯絡人不存在'}), 404
            
    except Exception as e:
        logger.error(f"更新聯絡人錯誤: {str(e)}")
        return jsonify({'error': '無法更新聯絡人資訊'}), 500

# 5. 刪除聯絡人
@app.route('/api/crm/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    try:
        service = get_crm_service()
        success = service.delete_contact(contact_id)
        
        if success:
            return jsonify({'status': 'deleted'}), 200
        else:
            return jsonify({'error': '聯絡人不存在'}), 404
            
    except Exception as e:
        logger.error(f"刪除聯絡人錯誤: {str(e)}")
        return jsonify({'error': '無法刪除聯絡人'}), 500

# 6. CRM 統計資訊
@app.route('/api/crm/statistics', methods=['GET'])
def get_crm_statistics():
    try:
        service = get_crm_service()
        stats = service.get_statistics()
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"取得統計資訊錯誤: {str(e)}")
        return jsonify({'error': '無法取得統計資訊'}), 500

# WebSocket事件處理
@socketio.on('connect')
def handle_connect():
    logger.info(f"客戶端連接: {request.sid}")
    emit('connected', {'message': '連接成功'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"客戶端斷開: {request.sid}")


# 靜態檔案服務（開發用）
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# 錯誤處理
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '端點未找到'}), 404


# ==================== 錯誤處理 ====================

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"內部錯誤: {str(error)}")
    return jsonify({'error': '內部伺服器錯誤'}), 500

if __name__ == '__main__':
    import os
    import ssl
    
    # SSL 證書配置
    ssl_context = None
    
    # 檢查 SSL 證書文件
    cert_locations = [
        # 優先檢查項目根目錄
         ('../../ssl/certificate.crt', '../../ssl/private.key', '../../ssl/ca.crt'),
        ('../certificate.crt', '../private.key', '../ca.crt'),
        ('certificate.crt', 'private.key', 'ca.crt'),
        # 檢查 backend 目錄
        ('backend/certificate.crt', 'backend/private.key', 'backend/ca.crt'),
        # 檢查 certs 目錄
        ('../certs/certificate.crt', '../certs/private.key', '../certs/ca.crt'),
        ('certs/certificate.crt', 'certs/private.key', 'certs/ca.crt'),
    ]
    
    for cert_file, key_file, ca_file in cert_locations:
        cert_path = Path(cert_file).resolve()
        key_path = Path(key_file).resolve()
        ca_path = Path(ca_file).resolve()
        
        if cert_path.exists() and key_path.exists():
            try:
                # 創建 SSL context
                ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                
                # 載入證書和私鑰
                ssl_context.load_cert_chain(
                    certfile=str(cert_path),
                    keyfile=str(key_path)
                )
                
                # 如果有 CA 證書，載入它
                if ca_path.exists():
                    ssl_context.load_verify_locations(cafile=str(ca_path))
                
                logger.info(f"SSL 證書載入成功:")
                logger.info(f"   證書: {cert_path}")
                logger.info(f"   私鑰: {key_path}")
                if ca_path.exists():
                    logger.info(f"   CA證書: {ca_path}")
                break
            except Exception as e:
                logger.warning(f"載入 SSL 證書失敗: {e}")
                ssl_context = None
    
    # 根據是否有 SSL 證書決定使用 HTTP 或 HTTPS
    if ssl_context:
        # 使用 HTTPS
        logger.info(f"啟動 HTTPS 服務器")
        logger.info(f"   訪問地址: https://{Config.HOST}:{Config.PORT}")
    else:
        # 沒有證書，使用 HTTP
        logger.warning("未找到 SSL 證書，使用 HTTP 模式")
        logger.info(f"   訪問地址: http://{Config.HOST}:{Config.PORT}")
        
        # 開發環境可以使用自簽名證書
        if Config.DEBUG:
            logger.info("提示: 開發環境可以使用以下命令生成自簽名證書:")
            logger.info("   openssl req -x509 -newkey rsa:4096 -nodes -out certificate.crt -keyout private.key -days 365")
    
    logger.info("啟動 AI 語音處理系統")
    
    # 預載入服務
    init_services()
    
    # 啟動服務器
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        ssl_context=ssl_context  # 傳入 SSL context (可能為 None)
    )