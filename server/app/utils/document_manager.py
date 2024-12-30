from typing import List, Dict, Optional
import os
import json
from datetime import datetime, timedelta
from ..config import settings
import asyncio
import aiofiles
import hashlib

class DocumentManager:
    def __init__(self):
        self.cache_dir = os.path.join(settings.UPLOAD_DIR, 'cache')
        self.progress_dir = os.path.join(settings.UPLOAD_DIR, 'progress')
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.progress_dir, exist_ok=True)

    def get_document_id(self, file_path: str) -> str:
        """生成文档唯一ID"""
        with open(file_path, 'rb') as f:
            file_hash = hashlib.md5(f.read()).hexdigest()
        return f"{os.path.basename(file_path)}_{file_hash}"

    async def split_content(self, content: str) -> List[str]:
        """将内容分割成固定大小的页面"""
        pages = []
        current_page = []
        current_size = 0
        
        paragraphs = content.split('\n')
        
        for paragraph in paragraphs:
            # 如果段落太长，需要分割
            if len(paragraph) > settings.PAGE_SIZE:
                # 按句子分割
                sentences = paragraph.split('. ')
                for sentence in sentences:
                    if current_size + len(sentence) > settings.PAGE_SIZE:
                        pages.append('\n'.join(current_page))
                        current_page = [sentence]
                        current_size = len(sentence)
                    else:
                        current_page.append(sentence)
                        current_size += len(sentence)
            else:
                if current_size + len(paragraph) > settings.PAGE_SIZE:
                    pages.append('\n'.join(current_page))
                    current_page = [paragraph]
                    current_size = len(paragraph)
                else:
                    current_page.append(paragraph)
                    current_size += len(paragraph)
        
        if current_page:
            pages.append('\n'.join(current_page))
        
        return pages

    async def save_pages(self, doc_id: str, pages: List[str]):
        """保存分页结果到缓存"""
        cache_file = os.path.join(self.cache_dir, f"{doc_id}.json")
        async with aiofiles.open(cache_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps({
                'pages': pages,
                'total_pages': len(pages),
                'created_at': datetime.now().isoformat()
            }))

    async def get_pages(self, doc_id: str, start_page: int, num_pages: int) -> Dict:
        """获取指定范围的页面"""
        cache_file = os.path.join(self.cache_dir, f"{doc_id}.json")
        if not os.path.exists(cache_file):
            return None
        
        async with aiofiles.open(cache_file, 'r', encoding='utf-8') as f:
            data = json.loads(await f.read())
            
        total_pages = data['total_pages']
        start_page = max(0, min(start_page, total_pages - 1))
        end_page = min(start_page + num_pages, total_pages)
        
        return {
            'pages': data['pages'][start_page:end_page],
            'current_page': start_page + 1,
            'total_pages': total_pages,
            'has_more': end_page < total_pages
        }

    async def save_progress(self, doc_id: str, user_id: str, page: int):
        """保存阅读进度"""
        if not settings.SAVE_READING_PROGRESS:
            return
            
        progress_file = os.path.join(self.progress_dir, f"{user_id}.json")
        progress = {}
        
        if os.path.exists(progress_file):
            async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
                progress = json.loads(await f.read())
        
        progress[doc_id] = {
            'page': page,
            'updated_at': datetime.now().isoformat()
        }
        
        # 清理过期进度
        expire_date = datetime.now() - timedelta(days=settings.PROGRESS_EXPIRE_DAYS)
        progress = {
            k: v for k, v in progress.items()
            if datetime.fromisoformat(v['updated_at']) > expire_date
        }
        
        async with aiofiles.open(progress_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(progress))

    async def get_progress(self, doc_id: str, user_id: str) -> Optional[int]:
        """获取阅读进度"""
        if not settings.SAVE_READING_PROGRESS:
            return None
            
        progress_file = os.path.join(self.progress_dir, f"{user_id}.json")
        if not os.path.exists(progress_file):
            return None
            
        async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
            progress = json.loads(await f.read())
            
        if doc_id in progress:
            return progress[doc_id]['page']
        return None

    async def clean_old_cache(self):
        """清理过期的缓存文件"""
        for file in os.listdir(self.cache_dir):
            if not file.endswith('.json'):
                continue
                
            file_path = os.path.join(self.cache_dir, file)
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                data = json.loads(await f.read())
                created_at = datetime.fromisoformat(data['created_at'])
                
                if datetime.now() - created_at > timedelta(days=settings.PROGRESS_EXPIRE_DAYS):
                    os.remove(file_path)
