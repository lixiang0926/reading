from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from typing import Optional
import os
import uuid
from datetime import datetime

from .processors import FileProcessor
from .utils.cache import Cache
from .config import settings

app = FastAPI(title="Bionic Reading API")

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化缓存
cache = Cache()

# 创建上传目录
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

@app.post("/api/parse")
async def parse_file(
    file: UploadFile = File(...),
    bionic_enabled: bool = True,
    page: int = 1,
    user_id: Optional[str] = None,
    background_tasks: BackgroundTasks = None
):
    try:
        # 检查文件大小
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件大小超过限制 ({settings.MAX_FILE_SIZE_MB}MB)"
            )

        # 获取文件扩展名
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="不支持的文件格式"
            )

        # 生成唯一文件名
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)

        # 处理文件
        processor = FileProcessor()
        result = await processor.process_file(
            file_path,
            file_ext,
            bionic_enabled,
            page,
            user_id
        )

        # 删除临时文件
        background_tasks.add_task(os.remove, file_path)

        return JSONResponse(result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/content/{doc_id}")
async def get_content(
    doc_id: str,
    page: int = 1,
    user_id: Optional[str] = None,
    bionic_enabled: bool = True
):
    try:
        processor = FileProcessor()
        doc_manager = processor.doc_manager
        
        # 获取页面内容
        pages_data = await doc_manager.get_pages(
            doc_id,
            page - 1,
            settings.MAX_PAGES_PER_REQUEST
        )
        
        if not pages_data:
            raise HTTPException(
                status_code=404,
                detail="文档不存在或已过期"
            )
            
        # 应用仿生阅读处理
        if bionic_enabled:
            pages_data['pages'] = [
                await processor.apply_bionic_reading(page_content)
                for page_content in pages_data['pages']
            ]
            
        # 保存阅读进度
        if user_id:
            await doc_manager.save_progress(doc_id, user_id, page)
            
        return JSONResponse({
            'success': True,
            'content': pages_data['pages'],
            'current_page': pages_data['current_page'],
            'total_pages': pages_data['total_pages'],
            'has_more': pages_data['has_more']
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/progress/{doc_id}")
async def get_progress(
    doc_id: str,
    user_id: str
):
    try:
        processor = FileProcessor()
        progress = await processor.doc_manager.get_progress(doc_id, user_id)
        
        return JSONResponse({
            'success': True,
            'progress': progress
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/document/{doc_id}/structure")
async def get_document_structure(doc_id: str):
    """获取文档结构（目录、元数据等）"""
    try:
        processor = FileProcessor()
        structure = await processor.get_document_structure(doc_id)
        
        if not structure:
            raise HTTPException(
                status_code=404,
                detail="文档不存在或已过期"
            )
            
        return JSONResponse({
            'success': True,
            'structure': structure
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/document/{doc_id}/chapter/{chapter_id}")
async def get_chapter_content(
    doc_id: str,
    chapter_id: str,
    user_id: Optional[str] = None,
    bionic_enabled: bool = True
):
    """获取指定章节的内容"""
    try:
        processor = FileProcessor()
        content = await processor.get_chapter_content(
            doc_id,
            chapter_id,
            bionic_enabled
        )
        
        if not content:
            raise HTTPException(
                status_code=404,
                detail="章节不存在"
            )
            
        # 保存阅读进度
        if user_id:
            await processor.doc_manager.save_progress(doc_id, user_id, chapter_id)
            
        return JSONResponse({
            'success': True,
            'content': content
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/api/document/{doc_id}/bookmark")
async def add_bookmark(
    doc_id: str,
    user_id: str,
    position: dict
):
    """添加书签"""
    try:
        processor = FileProcessor()
        await processor.add_bookmark(doc_id, user_id, position)
        
        return JSONResponse({
            'success': True,
            'message': '书签添加成功'
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/document/{doc_id}/bookmarks")
async def get_bookmarks(
    doc_id: str,
    user_id: str
):
    """获取书签列表"""
    try:
        processor = FileProcessor()
        bookmarks = await processor.get_bookmarks(doc_id, user_id)
        
        return JSONResponse({
            'success': True,
            'bookmarks': bookmarks
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/document/{doc_id}/search")
async def search_document(
    doc_id: str,
    query: str,
    page: int = 1,
    limit: int = 10
):
    """搜索文档内容"""
    try:
        processor = FileProcessor()
        results = await processor.search_document(
            doc_id,
            query,
            page,
            limit
        )
        
        return JSONResponse({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/document/{doc_id}/metadata")
async def get_document_metadata(doc_id: str):
    """获取文档元数据"""
    try:
        processor = FileProcessor()
        metadata = await processor.get_document_metadata(doc_id)
        
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail="文档不存在或已过期"
            )
            
        return JSONResponse({
            'success': True,
            'metadata': metadata
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
