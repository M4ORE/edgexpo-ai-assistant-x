import json
import os
from pathlib import Path
from typing import List, Dict, Optional
import uuid
from datetime import datetime

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma
from langchain.schema import Document
from sentence_transformers import SentenceTransformer

from backend.config import ModelConfig, KNOWLEDGE_BASE_DIR
from backend.utils.logger import setup_logger
from backend.models.llm_handler import LLMHandler

logger = setup_logger(__name__)

class RAGService:
    """檢索增強生成服務"""
    
    def __init__(self):
        self.knowledge_base_dir = KNOWLEDGE_BASE_DIR
        self.vector_db_path = ModelConfig.VECTOR_DB_PATH
        self.embedding_model_name = ModelConfig.EMBEDDING_MODEL
        self.vector_db_type = ModelConfig.VECTOR_DB_TYPE
        self.chunk_size = ModelConfig.CHUNK_SIZE
        self.chunk_overlap = ModelConfig.CHUNK_OVERLAP
        
        self.embeddings = None
        self.vector_store = None
        self.llm_handler = None
        self.knowledge_items = {}
        
        self._initialize()
    
    def _initialize(self):
        """初始化RAG服務"""
        try:
            # 初始化嵌入模型
            logger.info(f"載入嵌入模型: {self.embedding_model_name}")
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.embedding_model_name,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            
            # 初始化向量資料庫
            self._init_vector_store()
            
            # 初始化LLM處理器
            self.llm_handler = LLMHandler()
            
            # 載入知識庫
            self._load_knowledge_base()
            
            logger.info("RAG服務初始化成功")
            
        except Exception as e:
            logger.error(f"RAG服務初始化失敗: {str(e)}")
            raise
    
    def _init_vector_store(self):
        """初始化向量資料庫"""
        try:
            from chromadb.config import Settings
            self.vector_store = Chroma(
                persist_directory=str(self.vector_db_path),
                embedding_function=self.embeddings,
                collection_name="knowledge_base"
            )
            logger.info(f"ChromaDB 向量資料庫初始化成功")
        except Exception as e:
            logger.error(f"向量資料庫初始化失敗: {str(e)}")
            raise
    
    def _load_knowledge_base(self):
        """載入知識庫檔案"""
        try:
            # 載入公司資訊
            company_file = self.knowledge_base_dir / "company_info.json"
            if company_file.exists():
                with open(company_file, 'r', encoding='utf-8') as f:
                    company_data = json.load(f)
                    self._process_company_info(company_data)
            
            # 載入問答對
            qa_file = self.knowledge_base_dir / "qa_pairs.json"
            if qa_file.exists():
                with open(qa_file, 'r', encoding='utf-8') as f:
                    qa_data = json.load(f)
                    self._process_qa_pairs(qa_data)
            
            logger.info(f"載入知識庫完成，共 {len(self.knowledge_items)} 個項目")
            
        except Exception as e:
            logger.error(f"載入知識庫失敗: {str(e)}")
    
    def _process_company_info(self, data: dict):
        """處理公司資訊"""
        company = data.get('company', {})
        
        # 公司基本資訊
        if company:
            item_id = 'company_info'
            content = f"""
公司名稱：{company.get('name', '')}
公司簡介：{company.get('description', '')}
成立時間：{company.get('founded', '')}
使命願景：{company.get('mission', '')}
"""
            self._add_to_vector_store(item_id, content, 'company')
            
            # 產品資訊
            for product in company.get('products', []):
                item_id = f"product_{product.get('name', 'unknown')}"
                content = f"""
產品名稱：{product.get('name', '')}
產品描述：{product.get('description', '')}
主要功能：{', '.join(product.get('features', []))}
"""
                self._add_to_vector_store(item_id, content, 'product')
    
    def _process_qa_pairs(self, data: dict):
        """處理問答對"""
        qa_pairs = data.get('qa_pairs', [])
        
        for qa in qa_pairs:
            item_id = qa.get('id', str(uuid.uuid4()))
            content = f"""
問題：{qa.get('question', '')}
答案：{qa.get('answer', '')}
關鍵詞：{', '.join(qa.get('keywords', []))}
"""
            self._add_to_vector_store(
                item_id, 
                content, 
                qa.get('category', 'general')
            )
    
    def _add_to_vector_store(self, item_id: str, content: str, category: str):
        """添加內容到向量資料庫"""
        try:
            # 分割文本
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                length_function=len,
            )
            
            chunks = text_splitter.split_text(content)
            
            # 創建文檔
            documents = []
            for i, chunk in enumerate(chunks):
                doc = Document(
                    page_content=chunk,
                    metadata={
                        'item_id': item_id,
                        'category': category,
                        'chunk_id': i
                    }
                )
                documents.append(doc)
            
            # 添加到向量資料庫
            self.vector_store.add_documents(documents)
            
            # 保存到記憶體
            self.knowledge_items[item_id] = {
                'content': content,
                'category': category,
                'chunks': len(chunks)
            }
            
        except Exception as e:
            logger.error(f"添加到向量資料庫失敗: {str(e)}")
    
    def query(self, query: str, language: str = 'zh-TW', top_k: int = 5) -> str:
        """
        執行RAG查詢
        
        Args:
            query: 查詢問題
            language: 語言
            top_k: 返回的相關文檔數量
            
        Returns:
            str: AI生成的回答
        """
        try:
            # 搜尋相關文檔
            relevant_docs = self.vector_store.similarity_search(
                query, 
                k=top_k
            )
            
            # 構建上下文
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            # 構建提示詞
            if 'zh' in language:
                prompt = f"""基於以下相關資訊回答用戶的問題。如果資訊中沒有相關內容，請誠實地說不知道。

相關資訊：
{context}

用戶問題：{query}

請用繁體中文回答："""
            else:
                prompt = f"""Answer the user's question based on the following relevant information. If the information doesn't contain the answer, honestly say you don't know.

Relevant Information:
{context}

User Question: {query}

Please answer in English:"""
            
            # 使用LLM生成回答
            response = self.llm_handler.generate(prompt)
            
            return response
            
        except Exception as e:
            logger.error(f"RAG查詢失敗: {str(e)}")
            # 返回預設回應
            if 'zh' in language:
                return "抱歉，我無法回答您的問題。請稍後再試。"
            else:
                return "Sorry, I cannot answer your question. Please try again later."
    
    def list_knowledge_items(self) -> List[Dict]:
        """列出所有知識庫項目"""
        items = []
        
        # 從檔案重新載入以確保最新
        self._load_knowledge_base()
        
        for item_id, item_data in self.knowledge_items.items():
            # 提取標題（第一行或前50個字）
            content_lines = item_data['content'].strip().split('\n')
            title = content_lines[0][:50] if content_lines else item_id
            
            items.append({
                'id': item_id,
                'title': title,
                'category': item_data['category'],
                'content': item_data['content'],
                'chunks': item_data['chunks']
            })
        
        return items
    
    def update_knowledge_item(self, item_id: str, content: str, category: str = 'general') -> bool:
        """更新知識庫項目"""
        try:
            # 如果是新項目，生成ID
            if not item_id:
                item_id = f"kb_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
            
            # 更新向量資料庫
            # 先刪除舊的（如果存在）
            if item_id in self.knowledge_items:
                # TODO: 實現向量資料庫的刪除功能
                pass
            
            # 添加新的
            self._add_to_vector_store(item_id, content, category)
            
            # 保存到檔案（簡化版本，實際應該更新對應的JSON檔案）
            self._save_to_file(item_id, content, category)
            
            return True
            
        except Exception as e:
            logger.error(f"更新知識項目失敗: {str(e)}")
            return False
    
    def delete_knowledge_item(self, item_id: str) -> bool:
        """刪除知識庫項目"""
        try:
            if item_id in self.knowledge_items:
                del self.knowledge_items[item_id]
                # TODO: 從向量資料庫中刪除
                # TODO: 從檔案中刪除
                return True
            return False
        except Exception as e:
            logger.error(f"刪除知識項目失敗: {str(e)}")
            return False
    
    def _save_to_file(self, item_id: str, content: str, category: str):
        """保存到檔案（簡化實現）"""
        # 這是一個簡化的實現
        # 實際應該根據category更新對應的JSON檔案
        custom_kb_file = self.knowledge_base_dir / "custom_kb.json"
        
        try:
            if custom_kb_file.exists():
                with open(custom_kb_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {'items': []}
            
            # 更新或添加項目
            found = False
            for item in data['items']:
                if item.get('id') == item_id:
                    item['content'] = content
                    item['category'] = category
                    found = True
                    break
            
            if not found:
                data['items'].append({
                    'id': item_id,
                    'content': content,
                    'category': category
                })
            
            # 保存
            with open(custom_kb_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"保存到檔案失敗: {str(e)}")