import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Optional, Dict, Any, List
import tempfile
from pathlib import Path
import json
import numpy as np
import time
import functools

from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


# 重試裝飾器
def with_retry(max_retries=3, backoff_factor=0.3, status_forcelist=(500, 502, 504)):
    """重試裝飾器，用於微服務調用"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    last_exception = e
                    if attempt < max_retries:
                        wait_time = backoff_factor * (2 ** attempt)
                        logger.warning(f"{func.__name__} attempt {attempt + 1} failed: {str(e)}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"{func.__name__} failed after {max_retries + 1} attempts: {str(e)}")
                        raise
                except Exception as e:
                    logger.error(f"{func.__name__} failed with non-request error: {str(e)}")
                    raise
            
            raise last_exception
        return wrapper
    return decorator


class ServiceSession:
    """微服務會話管理，包含連接池和重試策略"""
    
    def __init__(self, service_name: str, max_retries=3, pool_connections=10, pool_maxsize=20):
        self.service_name = service_name
        self.session = requests.Session()
        
        # 配置重試策略
        retry_strategy = Retry(
            total=max_retries,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST"],
            backoff_factor=0.3
        )
        
        # 配置連接池
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=pool_connections,
            pool_maxsize=pool_maxsize
        )
        
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # 設置預設超時和標頭
        self.session.headers.update({
            'User-Agent': f'EdgExpo-{service_name}-Client/1.0'
        })
    
    def request(self, method: str, url: str, timeout: int = 30, **kwargs):
        """統一的請求方法"""
        try:
            response = self.session.request(method, url, timeout=timeout, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.Timeout:
            logger.error(f"{self.service_name} service timeout: {url}")
            raise Exception(f"{self.service_name}服務請求超時")
        except requests.exceptions.ConnectionError:
            logger.error(f"{self.service_name} service connection error: {url}")
            raise Exception(f"{self.service_name}服務連接失敗")
        except requests.exceptions.HTTPError as e:
            logger.error(f"{self.service_name} service HTTP error: {e.response.status_code}")
            raise Exception(f"{self.service_name}服務HTTP錯誤: {e.response.status_code}")
    
    def close(self):
        """關閉會話"""
        self.session.close()

class STTServiceClient:
    """語音轉文字微服務客戶端 (優化版)"""
    
    def __init__(self, service_url: str):
        self.service_url = service_url
        self.timeout = 60  # STT處理可能需要較長時間
        self.session = ServiceSession("STT", max_retries=2)  # STT一般比較穩定，減少重試次數
    
    @with_retry(max_retries=2, backoff_factor=0.5)
    def transcribe(self, audio_file_path: str, language: str = 'zh') -> str:
        """
        調用STT微服務進行語音識別 (優化版)
        
        Args:
            audio_file_path: 音頻文件路徑
            language: 語言代碼 ('zh', 'en', etc.)
            
        Returns:
            str: 識別出的文字
        """
        # 語言代碼映射 (後端API -> STT微服務)
        lang_mapping = {
            'zh-TW': 'zh',
            'zh-CN': 'zh', 
            'zh': 'zh',
            'en-US': 'en',
            'en': 'en'
        }
        
        stt_language = lang_mapping.get(language, language)
        
        with open(audio_file_path, 'rb') as f:
            files = {'audio': f}
            data = {'language': stt_language}
            
            response = self.session.request(
                'POST',
                f"{self.service_url}/transcribe", 
                files=files, 
                data=data,
                timeout=self.timeout
            )
            
            result = response.json()
            
            if response.status_code == 200:
                return result.get('transcription', '')
            elif response.status_code == 202:
                # 請求被加入隊列，返回錯誤信息
                raise Exception(f"STT服務繁忙，請求已加入隊列: {result.get('message', '')}")
            else:
                error_detail = result.get('error', '')
                raise Exception(f"STT服務錯誤: {response.status_code} - {error_detail}")
    
    def check_health(self) -> Dict[str, Any]:
        """檢查STT服務健康狀態 (優化版)"""
        try:
            response = self.session.request('GET', f"{self.service_url}/health", timeout=5)
            return response.json()
        except Exception as e:
            logger.warning(f"STT健康檢查失敗: {str(e)}")
            return {"status": "unreachable", "error": str(e)}
    
    def close(self):
        """關閉服務會話"""
        self.session.close()


class TTSServiceClient:
    """文字轉語音微服務客戶端 (優化版)"""
    
    def __init__(self, service_url: str):
        self.service_url = service_url
        self.timeout = 30
        self.temp_dir = Path(tempfile.gettempdir()) / "tts_cache"
        self.temp_dir.mkdir(exist_ok=True)
        self.session = ServiceSession("TTS", max_retries=3)  # TTS可能需要更多重試
    
    @with_retry(max_retries=3, backoff_factor=0.4)
    def synthesize(self, text: str, language: str = 'zh-tw') -> str:
        """
        調用TTS微服務進行語音合成
        
        Args:
            text: 要轉換的文字
            language: 語言代碼
            
        Returns:
            str: 生成音頻文件的路徑
        """
        try:
            # 語言代碼映射 (後端API -> TTS微服務) 
            lang_mapping = {
                'zh-TW': 'zh-tw',
                'zh-CN': 'zh-cn',
                'zh': 'zh-tw',  # 預設使用繁體中文
                'en-US': 'en',
                'en': 'en'
            }
            
            tts_language = lang_mapping.get(language, language)
            
            data = {
                'text': text,
                'lang': tts_language,
                'format': 'file'
            }
            
            response = self.session.request(
                'POST',
                f"{self.service_url}/tts", 
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                # 保存音頻到臨時文件
                temp_file = tempfile.NamedTemporaryFile(
                    suffix='.wav', 
                    delete=False,
                    dir=self.temp_dir
                )
                temp_file.write(response.content)
                temp_file.close()
                
                return temp_file.name
            else:
                error_msg = f"TTS服務錯誤: {response.status_code}"
                try:
                    error_detail = response.json().get('error', '')
                    error_msg += f" - {error_detail}"
                except:
                    pass
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"TTS服務調用錯誤: {str(e)}")
            raise
    
    def get_available_languages(self) -> List[str]:
        """取得支援的語言列表"""
        try:
            response = self.session.request('GET', f"{self.service_url}/languages", timeout=5)
            if response.status_code == 200:
                result = response.json()
                return result.get('supported_languages', [])
            else:
                return ['en', 'zh-tw', 'zh-cn']  # 預設列表
        except Exception as e:
            logger.error(f"取得TTS語言列表失敗: {str(e)}")
            return ['en', 'zh-tw', 'zh-cn']
    
    def get_available_voices(self) -> Dict[str, List[str]]:
        """取得可用語音列表"""
        try:
            response = self.session.request('GET', f"{self.service_url}/voices", timeout=5)
            if response.status_code == 200:
                result = response.json()
                return result.get('voices', {})
            else:
                # 預設語音映射
                return {
                    'en': ['en-US-AriaNeural'],
                    'zh-tw': ['zh-TW-HsiaoChenNeural'],
                    'zh-cn': ['zh-CN-XiaoxiaoNeural']
                }
        except Exception as e:
            logger.error(f"取得TTS語音列表失敗: {str(e)}")
            return {
                'en': ['en-US-AriaNeural'],
                'zh-tw': ['zh-TW-HsiaoChenNeural'], 
                'zh-cn': ['zh-CN-XiaoxiaoNeural']
            }
    
    def check_health(self) -> Dict[str, Any]:
        """檢查TTS服務健康狀態"""
        try:
            response = self.session.request('GET', f"{self.service_url}/health", timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "unhealthy", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}
    
    def cleanup_temp_files(self):
        """清理臨時文件"""
        try:
            for file_path in self.temp_dir.glob("*.wav"):
                if file_path.is_file():
                    file_path.unlink()
            logger.info("TTS臨時文件清理完成")
        except Exception as e:
            logger.error(f"TTS臨時文件清理失敗: {str(e)}")
    
    def close(self):
        """關閉服務會話"""
        self.session.close()


class EmbeddingServiceClient:
    """嵌入向量微服務客戶端 (Ollama相容API)"""
    
    def __init__(self, service_url: str):
        self.service_url = service_url
        self.timeout = 30
        self.default_model = "nomic-embed"
    
    def get_embeddings(self, texts: List[str], model: str = None) -> List[List[float]]:
        """
        批次生成嵌入向量
        
        Args:
            texts: 文字列表
            model: 模型名稱
            
        Returns:
            List[List[float]]: 嵌入向量列表
        """
        if not model:
            model = self.default_model
            
        try:
            # 使用 Ollama 相容 API
            data = {
                'model': model,
                'input': texts if len(texts) > 1 else texts[0]
            }
            
            response = requests.post(
                f"{self.service_url}/api/embeddings",
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('embeddings', [])
            else:
                error_msg = f"Embedding服務錯誤: {response.status_code}"
                try:
                    error_detail = response.json().get('detail', '')
                    error_msg += f" - {error_detail}"
                except:
                    pass
                raise Exception(error_msg)
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Embedding服務連接失敗: {str(e)}")
            raise Exception("Embedding服務暫時不可用")
        except Exception as e:
            logger.error(f"Embedding服務調用錯誤: {str(e)}")
            raise
    
    def get_embedding(self, text: str, model: str = None) -> List[float]:
        """
        生成單個文字的嵌入向量
        
        Args:
            text: 文字內容
            model: 模型名稱
            
        Returns:
            List[float]: 嵌入向量
        """
        embeddings = self.get_embeddings([text], model)
        return embeddings[0] if embeddings else []
    
    def get_embedding_batch_simple(self, texts: List[str], model: str = None) -> List[List[float]]:
        """
        使用簡化API進行批次嵌入 (備用方案)
        
        Args:
            texts: 文字列表
            model: 模型名稱
            
        Returns:
            List[List[float]]: 嵌入向量列表
        """
        if not model:
            model = self.default_model
            
        try:
            data = {
                'texts': texts,
                'model': model
            }
            
            response = requests.post(
                f"{self.service_url}/embed/batch",
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('embeddings', [])
            else:
                # 如果簡化API失敗，回退到標準API
                return self.get_embeddings(texts, model)
                
        except Exception as e:
            logger.warning(f"簡化API失敗，回退到標準API: {str(e)}")
            return self.get_embeddings(texts, model)
    
    def list_models(self) -> List[str]:
        """取得可用模型列表"""
        try:
            response = requests.get(f"{self.service_url}/api/tags", timeout=5)
            if response.status_code == 200:
                result = response.json()
                models = result.get('models', [])
                return [model['name'] for model in models]
            else:
                return [self.default_model]  # 預設返回nomic-embed
        except Exception as e:
            logger.error(f"取得Embedding模型列表失敗: {str(e)}")
            return [self.default_model]
    
    def check_health(self) -> Dict[str, Any]:
        """檢查Embedding服務健康狀態"""
        try:
            response = requests.get(f"{self.service_url}/health", timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "unhealthy", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}
    
    def close(self):
        """關閉服務會話"""
        self.session.close()


class LLMServiceClient:
    """大語言模型微服務客戶端 (使用OpenAI客戶端) (優化版)"""
    
    def __init__(self, service_url: str, api_key: str = "123"):
        self.service_url = service_url
        self.api_key = api_key
        self.timeout = 60  # LLM生成可能需要較長時間
        self.default_model = "Phi-3.5-mini"  # 匹配測試腳本的大小寫
        
        # 使用OpenAI客戶端 (與test-llm.py相同方式)
        try:
            from openai import OpenAI
            self.client = OpenAI(
                base_url=f"{service_url}/v1",
                api_key=api_key
            )
            logger.info(f"LLM OpenAI客戶端初始化成功: {service_url}")
        except ImportError:
            logger.error("OpenAI套件未安裝，請執行: pip install openai")
            raise Exception("OpenAI套件缺失")
        except Exception as e:
            logger.error(f"LLM OpenAI客戶端初始化失敗: {str(e)}")
            raise
    
    @with_retry(max_retries=2, backoff_factor=0.8)  # LLM生成需要更長的回退時間
    def generate(self, prompt: str, model: str = None, max_tokens: int = 512, 
                temperature: float = 0.7, **kwargs) -> str:
        """
        生成文字回應 (使用OpenAI客戶端)
        
        Args:
            prompt: 輸入提示詞
            model: 模型名稱
            max_tokens: 最大生成長度
            temperature: 溫度參數
            
        Returns:
            str: 生成的文字
        """
        if not model:
            model = self.default_model
            
        try:
            # 使用OpenAI客戶端 (與test-llm.py相同方式)
            messages = [{"role": "user", "content": prompt}]
            
            # 添加Genie特有的extra_body參數 (與測試腳本一致)
            extra_body = {
                "size": 4096, 
                "temp": temperature,  # 使用傳入的temperature
                "top_k": 13, 
                "top_p": 0.6
            }
            
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                extra_body=extra_body
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"LLM OpenAI客戶端調用錯誤: {str(e)}")
            raise Exception(f"LLM服務錯誤: {str(e)}")
    
    @with_retry(max_retries=2, backoff_factor=0.8)
    def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        """
        對話模式 (支援多輪對話) (使用OpenAI客戶端)
        
        Args:
            messages: 對話歷史 [{"role": "user/assistant", "content": "..."}]
            model: 模型名稱
            
        Returns:
            str: 生成的回應
        """
        if not model:
            model = self.default_model
            
        try:
            # 使用OpenAI客戶端 (與test-llm.py相同方式)
            temperature = kwargs.get('temperature', 0.7)
            max_tokens = kwargs.get('max_tokens', 512)
            
            # 添加Genie特有的extra_body參數
            extra_body = {
                "size": 4096,
                "temp": temperature, 
                "top_k": 13,
                "top_p": 0.6
            }
            
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                extra_body=extra_body
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"LLM OpenAI客戶端調用錯誤: {str(e)}")
            raise Exception(f"LLM服務錯誤: {str(e)}")
    
    def check_health(self) -> Dict[str, Any]:
        """檢查LLM服務健康狀態 (輕量級檢查)"""
        try:
            # 方法1: 嘗試獲取模型列表 (最輕量)
            try:
                models = self.client.models.list()
                logger.info(f"LLM健康檢查成功，可用模型: {[m.id for m in models.data[:3]]}")
                return {
                    "status": "healthy",
                    "model": self.default_model,
                    "service": "Genie LLM Service",
                    "available_models": len(models.data)
                }
            except Exception:
                # 方法2: 如果模型列表失敗，嘗試最短的completion
                messages = [{"role": "user", "content": "hi"}]
                
                extra_body = {
                    "size": 4096,
                    "temp": 0.1,  # 降低溫度提高確定性
                    "top_k": 1,   # 只取最可能的token
                    "top_p": 0.1
                }
                
                response = self.client.chat.completions.create(
                    model=self.default_model,
                    messages=messages,
                    max_tokens=1,  # 只生成1個token
                    extra_body=extra_body
                )
                
                content = response.choices[0].message.content
                logger.info(f"LLM健康檢查成功，快速回應: '{content}'")
                
                return {
                    "status": "healthy",
                    "model": self.default_model,
                    "service": "Genie LLM Service"
                }
            
        except Exception as e:
            logger.error(f"LLM健康檢查異常: {str(e)}")
            return {"status": "unreachable", "error": str(e)}
    
    def close(self):
        """關閉服務會話"""
        # OpenAI客戶端會自動處理連接管理
        pass