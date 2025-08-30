"""
CRM Service - Contact Relationship Management
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from backend.config import Config
from backend.models.contact import Contact
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)

class CRMService:
    def __init__(self):
        self.contacts_file = Config.DATA_DIR / 'contacts.json'
        self.contacts_file.parent.mkdir(parents=True, exist_ok=True)
        
        if not self.contacts_file.exists():
            self._init_contacts_file()
    
    def _init_contacts_file(self):
        """初始化聯絡人檔案"""
        initial_data = {
            "contacts": [],
            "metadata": {
                "version": "1.0",
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat()
            }
        }
        with open(self.contacts_file, 'w', encoding='utf-8') as f:
            json.dump(initial_data, f, ensure_ascii=False, indent=2)
        logger.info(f"初始化聯絡人檔案: {self.contacts_file}")
    
    def _load_contacts(self) -> Dict[str, Any]:
        """載入聯絡人數據"""
        try:
            with open(self.contacts_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # 確保數據結構正確
            if "contacts" not in data:
                data["contacts"] = []
            if "metadata" not in data:
                data["metadata"] = {
                    "version": "1.0",
                    "created_at": datetime.now().isoformat()
                }
                
            return data
            
        except Exception as e:
            logger.error(f"載入聯絡人檔案失敗: {e}")
            return {
                "contacts": [], 
                "metadata": {
                    "version": "1.0",
                    "created_at": datetime.now().isoformat()
                }
            }
    
    def _save_contacts(self, data: Dict[str, Any]):
        """儲存聯絡人數據"""
        try:
            # 確保metadata鍵存在
            if "metadata" not in data:
                data["metadata"] = {
                    "version": "1.0",
                    "created_at": datetime.now().isoformat()
                }
            
            data["metadata"]["last_updated"] = datetime.now().isoformat()
            with open(self.contacts_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"儲存聯絡人檔案失敗: {e}")
            raise
    
    def create_contact(self, contact_data: Dict[str, Any]) -> Contact:
        """建立新聯絡人"""
        try:
            # 生成符合API Schema的contact_id格式 (contact_xxxxxxxx)
            contact_id = f"contact_{uuid.uuid4().hex[:8]}"
            
            contact = Contact(
                contact_id=contact_id,
                name=contact_data.get('name', ''),
                company=contact_data.get('company', ''),
                position=contact_data.get('position', ''),
                email=contact_data.get('email', ''),
                phone=contact_data.get('phone', ''),
                address=contact_data.get('address', '')
            )
            
            # 設定notes (因為__init__不接受此參數)
            if 'notes' in contact_data:
                contact.notes = contact_data['notes']
            
            data = self._load_contacts()
            data["contacts"].append(contact.to_dict())
            self._save_contacts(data)
            
            logger.info(f"成功創建聯絡人: {contact.name} ({contact_id})")
            return contact
            
        except Exception as e:
            logger.error(f"創建聯絡人失敗: {e}")
            raise
    
    def get_contact(self, contact_id: str) -> Optional[Contact]:
        """獲取單一聯絡人"""
        try:
            data = self._load_contacts()
            
            for contact_data in data["contacts"]:
                if contact_data.get("contact_id") == contact_id:
                    return Contact.from_dict(contact_data)
            
            return None
            
        except Exception as e:
            logger.error(f"獲取聯絡人失敗: {e}")
            return None
    
    def list_contacts(self, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """列出聯絡人"""
        try:
            data = self._load_contacts()
            contacts = data["contacts"]
            
            total = len(contacts)
            paginated_contacts = contacts[offset:offset + limit]
            
            return {
                "contacts": paginated_contacts,
                "total": total,
                "limit": limit,
                "offset": offset
            }
            
        except Exception as e:
            logger.error(f"列出聯絡人失敗: {e}")
            return {"contacts": [], "total": 0, "limit": limit, "offset": offset}
    
    def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Optional[Contact]:
        """更新聯絡人"""
        try:
            data = self._load_contacts()
            
            for i, contact_data in enumerate(data["contacts"]):
                if contact_data.get("contact_id") == contact_id:
                    for key, value in update_data.items():
                        if key != "contact_id":
                            contact_data[key] = value
                    
                    contact_data["updated_at"] = datetime.now().isoformat()
                    self._save_contacts(data)
                    
                    return Contact.from_dict(contact_data)
            
            return None
            
        except Exception as e:
            logger.error(f"更新聯絡人失敗: {e}")
            return None
    
    def delete_contact(self, contact_id: str) -> bool:
        """刪除聯絡人"""
        try:
            data = self._load_contacts()
            
            original_count = len(data["contacts"])
            data["contacts"] = [
                contact for contact in data["contacts"] 
                if contact.get("contact_id") != contact_id
            ]
            
            if len(data["contacts"]) < original_count:
                self._save_contacts(data)
                logger.info(f"成功刪除聯絡人: {contact_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"刪除聯絡人失敗: {e}")
            return False
    
    # API 專用回應格式方法
    def create_contact_api_response(self, contact_data: Dict[str, Any]) -> Dict[str, str]:
        """建立聯絡人並返回API格式回應"""
        contact = self.create_contact(contact_data)
        return {
            "contact_id": contact.contact_id,
            "status": "created"
        }
    
    def list_contacts_api_response(self, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """列出聯絡人並返回API格式回應"""
        try:
            data = self._load_contacts()
            contacts = data["contacts"]
            
            total = len(contacts)
            paginated_contacts = contacts[offset:offset + limit]
            
            # 只返回API Schema需要的欄位
            simplified_contacts = []
            for contact in paginated_contacts:
                simplified_contacts.append({
                    "contact_id": contact["contact_id"],
                    "name": contact["name"],
                    "company": contact.get("company", ""),
                    "created_at": contact["created_at"]
                })
            
            return {
                "contacts": simplified_contacts,
                "total": total
            }
            
        except Exception as e:
            logger.error(f"列出聯絡人失敗: {e}")
            return {"contacts": [], "total": 0}
    
    def get_statistics(self) -> Dict[str, Any]:
        """獲取CRM統計數據"""
        try:
            data = self._load_contacts()
            contacts = data["contacts"]
            
            total_contacts = len(contacts)
            
            companies = {}
            for contact in contacts:
                company = contact.get("company", "未知公司")
                companies[company] = companies.get(company, 0) + 1
            
            recent_contacts = sorted(
                contacts,
                key=lambda x: x.get("created_at", ""),
                reverse=True
            )[:5]
            
            return {
                "total_contacts": total_contacts,
                "companies": companies,
                "recent_contacts": recent_contacts,
                "last_updated": data.get("metadata", {}).get("last_updated")
            }
            
        except Exception as e:
            logger.error(f"獲取統計數據失敗: {e}")
            return {"total_contacts": 0, "companies": {}, "recent_contacts": []}

    def mark_catalog_sent(self, contact_id: str):
        """標記已發送產品目錄"""
        try:
            data = self._load_contacts()
            
            for contact_data in data["contacts"]:
                if contact_data.get("contact_id") == contact_id:
                    contact_data["catalog_sent"] = True
                    contact_data["catalog_sent_at"] = datetime.now().isoformat()
                    contact_data["updated_at"] = datetime.now().isoformat()
                    break
            
            self._save_contacts(data)
            logger.info(f"標記聯絡人 {contact_id} 已發送產品目錄")
            
        except Exception as e:
            logger.error(f"標記產品目錄發送失敗: {e}")