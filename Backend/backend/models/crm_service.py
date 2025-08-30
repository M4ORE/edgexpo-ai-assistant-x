"""
CRM Service for Contact Management
聯絡人管理服務
"""
import os
import json
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone

from backend.models.contact import Contact

logger = logging.getLogger(__name__)


class CRMService:
    """CRM 聯絡人管理服務"""
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        初始化 CRM 服務
        
        Args:
            storage_path: 儲存路徑，預設為 data/contacts.json
        """
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            # 預設儲存在 data 目錄
            self.storage_path = Path(__file__).parent.parent.parent / 'data' / 'contacts.json'
        
        # 確保目錄存在
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 載入現有聯絡人
        self.contacts: Dict[str, Contact] = self._load_contacts()
        
        logger.info(f"CRM Service initialized with {len(self.contacts)} contacts")
    
    def _load_contacts(self) -> Dict[str, Contact]:
        """從檔案載入聯絡人"""
        contacts = {}
        
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for contact_data in data.get('contacts', []):
                        contact = Contact.from_dict(contact_data)
                        contacts[contact.contact_id] = contact
                
                logger.info(f"Loaded {len(contacts)} contacts from {self.storage_path}")
            except Exception as e:
                logger.error(f"Failed to load contacts: {str(e)}")
        
        return contacts
    
    def _save_contacts(self):
        """儲存聯絡人到檔案"""
        try:
            data = {
                'contacts': [contact.to_dict() for contact in self.contacts.values()],
                'last_updated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            }
            
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Saved {len(self.contacts)} contacts to {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to save contacts: {str(e)}")
            raise
    
    def create_contact(self, contact_data: Dict[str, Any]) -> Contact:
        """
        建立新聯絡人
        
        Args:
            contact_data: 聯絡人資料
            
        Returns:
            Contact: 建立的聯絡人物件
        """
        # 檢查必要欄位
        if 'name' not in contact_data:
            raise ValueError("Contact name is required")
        
        # 建立聯絡人
        contact = Contact(
            name=contact_data['name'],
            company=contact_data.get('company'),
            position=contact_data.get('position'),
            phone=contact_data.get('phone'),
            email=contact_data.get('email'),
            address=contact_data.get('address'),
            source=contact_data.get('source', 'business_card_scan')
        )
        
        # 儲存到記憶體和檔案
        self.contacts[contact.contact_id] = contact
        self._save_contacts()
        
        logger.info(f"Created contact: {contact.contact_id}")
        return contact
    
    def get_contact(self, contact_id: str) -> Optional[Contact]:
        """
        取得聯絡人
        
        Args:
            contact_id: 聯絡人ID
            
        Returns:
            Contact: 聯絡人物件，如果不存在則返回 None
        """
        return self.contacts.get(contact_id)
    
    def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Optional[Contact]:
        """
        更新聯絡人
        
        Args:
            contact_id: 聯絡人ID
            update_data: 更新資料
            
        Returns:
            Contact: 更新後的聯絡人物件
        """
        contact = self.contacts.get(contact_id)
        if contact:
            contact.update(**update_data)
            self._save_contacts()
            logger.info(f"Updated contact: {contact_id}")
            return contact
        
        logger.warning(f"Contact not found: {contact_id}")
        return None
    
    def delete_contact(self, contact_id: str) -> bool:
        """
        刪除聯絡人
        
        Args:
            contact_id: 聯絡人ID
            
        Returns:
            bool: 是否成功刪除
        """
        if contact_id in self.contacts:
            del self.contacts[contact_id]
            self._save_contacts()
            logger.info(f"Deleted contact: {contact_id}")
            return True
        
        logger.warning(f"Contact not found for deletion: {contact_id}")
        return False
    
    def list_contacts(self, limit: int = 10, offset: int = 0, 
                     filter_by: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        列出聯絡人
        
        Args:
            limit: 返回數量限制
            offset: 偏移量
            filter_by: 過濾條件
            
        Returns:
            dict: 包含聯絡人列表和總數
        """
        # 取得所有聯絡人並排序（最新的在前）
        all_contacts = sorted(
            self.contacts.values(),
            key=lambda c: c.created_at,
            reverse=True
        )
        
        # 應用過濾條件
        if filter_by:
            filtered = []
            for contact in all_contacts:
                match = True
                for key, value in filter_by.items():
                    if hasattr(contact, key):
                        contact_value = getattr(contact, key)
                        if contact_value != value:
                            match = False
                            break
                if match:
                    filtered.append(contact)
            all_contacts = filtered
        
        # 分頁
        total = len(all_contacts)
        contacts = all_contacts[offset:offset + limit]
        
        return {
            'contacts': [c.to_dict() for c in contacts],
            'total': total,
            'limit': limit,
            'offset': offset
        }
    
    def search_contacts(self, query: str) -> List[Contact]:
        """
        搜尋聯絡人
        
        Args:
            query: 搜尋關鍵字
            
        Returns:
            List[Contact]: 符合的聯絡人列表
        """
        query_lower = query.lower()
        results = []
        
        for contact in self.contacts.values():
            # 搜尋各個欄位
            searchable = [
                contact.name,
                contact.company,
                contact.email,
                contact.phone,
                contact.position
            ]
            
            for field in searchable:
                if field and query_lower in field.lower():
                    results.append(contact)
                    break
        
        return results
    
    def mark_catalog_sent(self, contact_id: str) -> bool:
        """
        標記已發送產品目錄
        
        Args:
            contact_id: 聯絡人ID
            
        Returns:
            bool: 是否成功標記
        """
        contact = self.contacts.get(contact_id)
        if contact:
            contact.mark_catalog_sent()
            self._save_contacts()
            logger.info(f"Marked catalog sent for contact: {contact_id}")
            return True
        
        logger.warning(f"Contact not found: {contact_id}")
        return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        取得統計資訊
        
        Returns:
            dict: 統計資訊
        """
        total = len(self.contacts)
        with_email = sum(1 for c in self.contacts.values() if c.email)
        with_phone = sum(1 for c in self.contacts.values() if c.phone)
        catalog_sent = sum(1 for c in self.contacts.values() if c.catalog_sent)
        
        return {
            'total_contacts': total,
            'contacts_with_email': with_email,
            'contacts_with_phone': with_phone,
            'catalogs_sent': catalog_sent
        }


# 單例模式
_crm_service = None

def get_crm_service() -> CRMService:
    """獲取 CRM 服務單例"""
    global _crm_service
    if _crm_service is None:
        _crm_service = CRMService()
    return _crm_service