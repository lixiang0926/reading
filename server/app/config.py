from pydantic_settings import BaseSettings
from typing import Set
import os

class Settings(BaseSettings):
    # API设置
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Bionic Reading API"

    # 文件处理设置
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    MAX_FILE_SIZE_MB: int = 10
    MAX_PDF_PAGES: int = 100
    
    # 分页设置
    PAGE_SIZE: int = 3000  # 每页字符数
    MAX_PAGES_PER_REQUEST: int = 10  # 每次请求最大页数
    CACHE_PAGES: bool = True  # 是否缓存分页结果
    
    # 章节设置
    MAX_CHAPTER_SIZE: int = 50000  # 每章节最大字符数
    AUTO_SPLIT_CHAPTERS: bool = True  # 是否自动分章
    
    # 进度保存
    SAVE_READING_PROGRESS: bool = True  # 是否保存阅读进度
    PROGRESS_EXPIRE_DAYS: int = 30  # 进度保存天数

    # 缓存设置
    REDIS_URL: str = "redis://localhost"
    CACHE_EXPIRE: int = 3600  # 1小时

    # 安全设置
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # 允许上传的文件类型
    ALLOWED_EXTENSIONS: Set[str] = {
        # 文本文件
        '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm',
        # Microsoft Office
        '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf',
        # OpenDocument
        '.odt', '.ods', '.odp',
        # PDF
        '.pdf',
        # 电子书
        '.epub', '.mobi',
        # 代码文件
        '.py', '.js', '.java', '.cpp', '.c', '.h', '.cs', '.php'
    }

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
