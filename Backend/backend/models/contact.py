"""
Contact Model for CRM
聯絡人資料模型
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid


class Contact:
    """聯絡人模型"""
    
    def __init__(
        self,
        name: str,
        company: Optional[str] = None,
        position: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        address: Optional[str] = None,
        source: str = 'business_card_scan',
        contact_id: Optional[str] = None
    ):
        """
        初始化聯絡人
        
        Args:
            name: 姓名
            company: 公司名稱
            position: 職位
            phone: 電話
            email: 電子郵件
            address: 地址
            source: 資料來源
            contact_id: 聯絡人ID（如果沒有會自動生成）
        """
        self.contact_id = contact_id or f"contact_{uuid.uuid4().hex[:8]}"
        self.name = name
        self.company = company
        self.position = position
        self.phone = phone
        self.email = email
        self.address = address
        self.source = source
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.tags = []
        self.notes = ""
        self.catalog_sent = False
        self.catalog_sent_at = None
    
    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式"""
        return {
            "contact_id": self.contact_id,
            "name": self.name,
            "company": self.company,
            "position": self.position,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "source": self.source,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
            "tags": self.tags,
            "notes": self.notes,
            "catalog_sent": self.catalog_sent,
            "catalog_sent_at": self.catalog_sent_at.isoformat() + "Z" if self.catalog_sent_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Contact':
        """從字典建立聯絡人物件"""
        contact = cls(
            name=data['name'],
            company=data.get('company'),
            position=data.get('position'),
            phone=data.get('phone'),
            email=data.get('email'),
            address=data.get('address'),
            source=data.get('source', 'business_card_scan'),
            contact_id=data.get('contact_id')
        )
        
        # 設定時間戳記
        if 'created_at' in data:
            contact.created_at = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        if 'updated_at' in data:
            contact.updated_at = datetime.fromisoformat(data['updated_at'].replace('Z', '+00:00'))
        
        # 設定其他屬性
        contact.tags = data.get('tags', [])
        contact.notes = data.get('notes', "")
        contact.catalog_sent = data.get('catalog_sent', False)
        
        if data.get('catalog_sent_at'):
            contact.catalog_sent_at = datetime.fromisoformat(
                data['catalog_sent_at'].replace('Z', '+00:00')
            )
        
        return contact
    
    def update(self, **kwargs):
        """更新聯絡人資訊"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.now(timezone.utc)
    
    def mark_catalog_sent(self):
        """標記已發送產品目錄"""
        self.catalog_sent = True
        self.catalog_sent_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
    
    def add_tag(self, tag: str):
        """新增標籤"""
        if tag not in self.tags:
            self.tags.append(tag)
            self.updated_at = datetime.now(timezone.utc)
    
    def remove_tag(self, tag: str):
        """移除標籤"""
        if tag in self.tags:
            self.tags.remove(tag)
            self.updated_at = datetime.now(timezone.utc)
    
    def __str__(self):
        """字串表示"""
        return f"Contact({self.contact_id}: {self.name} - {self.company})"
    
    def __repr__(self):
        """詳細表示"""
        return (f"Contact(id={self.contact_id}, name={self.name}, "
                f"company={self.company}, email={self.email})")