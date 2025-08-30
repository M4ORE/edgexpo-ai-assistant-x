import os
from pathlib import Path
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 基礎路徑
BASE_DIR = Path(__file__).parent.parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
KNOWLEDGE_BASE_DIR = BASE_DIR / "knowledge_base"
MODELS_DIR = BACKEND_DIR / "models" / "checkpoints"

# Flask配置
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))
    
    # CORS配置
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    
    # 上傳檔案配置
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = BASE_DIR / 'uploads'
    ALLOWED_EXTENSIONS = {'wav', 'mp3', 'webm', 'ogg', 'jpg', 'jpeg', 'png', 'mp4', 'webm'}
    
    # 數據目錄配置
    DATA_DIR = DATA_DIR
    ASSETS_DIR = DATA_DIR / 'assets'
    AUDIO_OUTPUT_DIR = DATA_DIR / 'audio_output'

# 微服務配置
class ServiceConfig:
    # STT微服務配置
    STT_SERVICE_URL = os.environ.get('STT_SERVICE_URL', 'http://localhost:5003')
    
    # TTS微服務配置
    TTS_SERVICE_URL = os.environ.get('TTS_SERVICE_URL', 'http://localhost:5004')
    
    # Embedding微服務配置
    EMBEDDING_SERVICE_URL = os.environ.get('EMBEDDING_SERVICE_URL', 'http://localhost:11434')
    
    # LLM微服務配置 (Genie OpenAI API v1)
    LLM_SERVICE_URL = os.environ.get('LLM_SERVICE_URL', 'http://127.0.0.1:8910')
    LLM_API_KEY = os.environ.get('LLM_API_KEY', '123')  # Genie使用固定API key

# 微服務相關配置 (簡化版)
class ModelConfig:
    # RAG配置 (向量資料庫相關)
    VECTOR_DB_TYPE = os.environ.get('VECTOR_DB_TYPE', 'chromadb')
    VECTOR_DB_PATH = KNOWLEDGE_BASE_DIR / 'vector_db'
    CHUNK_SIZE = int(os.environ.get('CHUNK_SIZE', 500))
    CHUNK_OVERLAP = int(os.environ.get('CHUNK_OVERLAP', 50))
    
    # 微服務模型名稱 (用於API調用)
    EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'nomic-embed')
    LLM_MODEL = os.environ.get('LLM_MODEL', 'Phi-3.5-mini')
    
    # 服務URL引用 (向後兼容)
    EMBEDDING_SERVICE_URL = ServiceConfig.EMBEDDING_SERVICE_URL
    TTS_SERVICE_URL = ServiceConfig.TTS_SERVICE_URL

# 日誌配置
class LogConfig:
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = BASE_DIR / 'logs' / 'app.log'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    LOG_MAX_SIZE = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 5

# 創建必要的目錄
def init_directories():
    dirs = [
        Config.UPLOAD_FOLDER,
        Config.ASSETS_DIR,
        Config.AUDIO_OUTPUT_DIR,
        MODELS_DIR,
        KNOWLEDGE_BASE_DIR,
        ModelConfig.VECTOR_DB_PATH,
        LogConfig.LOG_FILE.parent
    ]
    for dir_path in dirs:
        dir_path.mkdir(parents=True, exist_ok=True)

# 初始化配置
init_directories()