import logging
import logging.handlers
from pathlib import Path
from backend.config import LogConfig

def setup_logger(name: str) -> logging.Logger:
    """
    設置並返回一個配置好的logger實例
    
    Args:
        name: logger名稱
        
    Returns:
        logging.Logger: 配置好的logger實例
    """
    logger = logging.getLogger(name)
    
    # 如果logger已經有handler，直接返回
    if logger.handlers:
        return logger
    
    logger.setLevel(getattr(logging, LogConfig.LOG_LEVEL))
    
    # 創建格式器
    formatter = logging.Formatter(LogConfig.LOG_FORMAT)
    
    # 控制台處理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 檔案處理器（帶輪轉）
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            filename=LogConfig.LOG_FILE,
            maxBytes=LogConfig.LOG_MAX_SIZE,
            backupCount=LogConfig.LOG_BACKUP_COUNT,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        logger.error(f"無法創建日誌檔案: {e}")
    
    return logger