from typing import List, Dict, Optional
import re
from bs4 import BeautifulSoup
from ebooklib import epub
from docx import Document
import PyPDF2
import json
import os
from datetime import datetime

class Chapter:
    def __init__(self, title: str, level: int, content: str = "", start_position: int = 0):
        self.title = title
        self.level = level
        self.content = content
        self.start_position = start_position
        self.children: List[Chapter] = []
        self.parent: Optional[Chapter] = None

class DocumentStructure:
    def __init__(self):
        self.chapters: List[Chapter] = []
        self.metadata: Dict = {}
        self.bookmarks: List[Dict] = []
        self.total_pages: int = 0

    def extract_structure(self, file_path: str, file_ext: str) -> Dict:
        """提取文档结构，包括目录、元数据等"""
        if file_ext in ['.epub']:
            return self._process_epub(file_path)
        elif file_ext in ['.docx', '.doc']:
            return self._process_docx(file_path)
        elif file_ext == '.pdf':
            return self._process_pdf(file_path)
        elif file_ext == '.txt':
            return self._process_text(file_path)
        elif file_ext == '.md':
            return self._process_markdown(file_path)
        else:
            return self._process_generic(file_path)

    def _process_epub(self, file_path: str) -> Dict:
        book = epub.read_epub(file_path)
        
        # 提取元数据
        self.metadata = {
            'title': book.get_metadata('DC', 'title'),
            'creator': book.get_metadata('DC', 'creator'),
            'language': book.get_metadata('DC', 'language'),
            'publisher': book.get_metadata('DC', 'publisher'),
            'identifier': book.get_metadata('DC', 'identifier'),
        }

        # 提取目录
        toc = []
        for item in book.toc:
            if isinstance(item, tuple):
                section = item[0]
                toc.append({
                    'title': section.title,
                    'level': 1,
                    'href': section.href
                })

        # 处理章节内容
        chapters = []
        for item in book.get_items():
            if item.get_type() == epub.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                chapter_title = soup.find(['h1', 'h2', 'h3'])
                if chapter_title:
                    chapters.append({
                        'title': chapter_title.get_text(),
                        'content': str(soup),
                        'level': 1
                    })

        return {
            'metadata': self.metadata,
            'toc': toc,
            'chapters': chapters
        }

    def _process_docx(self, file_path: str) -> Dict:
        doc = Document(file_path)
        
        # 提取元数据
        self.metadata = {
            'author': doc.core_properties.author,
            'created': doc.core_properties.created,
            'modified': doc.core_properties.modified,
            'title': doc.core_properties.title,
        }

        # 分析段落层级和目录
        current_chapter = None
        chapters = []
        toc = []
        
        for para in doc.paragraphs:
            if para.style.name.startswith('Heading'):
                level = int(para.style.name[-1])
                chapter = {
                    'title': para.text,
                    'level': level,
                    'content': ''
                }
                
                toc.append({
                    'title': para.text,
                    'level': level
                })
                
                if current_chapter:
                    chapters.append(current_chapter)
                current_chapter = chapter
            elif current_chapter:
                current_chapter['content'] += para.text + '\n'
            else:
                current_chapter = {
                    'title': '前言',
                    'level': 1,
                    'content': para.text + '\n'
                }

        if current_chapter:
            chapters.append(current_chapter)

        return {
            'metadata': self.metadata,
            'toc': toc,
            'chapters': chapters
        }

    def _process_pdf(self, file_path: str) -> Dict:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            
            # 提取元数据
            self.metadata = reader.metadata if reader.metadata else {}
            
            # 提取书签
            bookmarks = []
            if '/Outlines' in reader.trailer['/Root']:
                def extract_bookmarks(bookmark, level=1):
                    for b in bookmark:
                        if isinstance(b, list):
                            extract_bookmarks(b, level + 1)
                        else:
                            bookmarks.append({
                                'title': b.title,
                                'page': b.page_number,
                                'level': level
                            })
                
                extract_bookmarks(reader.outline)

            # 提取章节（基于文本分析）
            chapters = []
            current_chapter = None
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                text = page.extract_text()
                
                # 查找可能的章节标题
                lines = text.split('\n')
                for line in lines:
                    if re.match(r'^(Chapter|Section|\d+\.)\s+\w+', line):
                        if current_chapter:
                            chapters.append(current_chapter)
                        current_chapter = {
                            'title': line.strip(),
                            'level': 1,
                            'content': '',
                            'page': page_num + 1
                        }
                    elif current_chapter:
                        current_chapter['content'] += line + '\n'
                    else:
                        current_chapter = {
                            'title': '开始',
                            'level': 1,
                            'content': line + '\n',
                            'page': 1
                        }

            if current_chapter:
                chapters.append(current_chapter)

            return {
                'metadata': self.metadata,
                'toc': bookmarks if bookmarks else [{'title': c['title'], 'level': c['level'], 'page': c['page']} for c in chapters],
                'chapters': chapters
            }

    def _process_text(self, file_path: str) -> Dict:
        chapters = []
        current_chapter = None
        chapter_pattern = re.compile(r'^(Chapter|Section|\d+\.)\s+\w+')
        
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                if chapter_pattern.match(line):
                    if current_chapter:
                        chapters.append(current_chapter)
                    current_chapter = {
                        'title': line.strip(),
                        'level': 1,
                        'content': ''
                    }
                elif current_chapter:
                    current_chapter['content'] += line
                else:
                    current_chapter = {
                        'title': '开始',
                        'level': 1,
                        'content': line
                    }

        if current_chapter:
            chapters.append(current_chapter)

        return {
            'metadata': {
                'title': os.path.basename(file_path),
                'created': datetime.fromtimestamp(os.path.getctime(file_path)).isoformat(),
                'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
            },
            'toc': [{'title': c['title'], 'level': c['level']} for c in chapters],
            'chapters': chapters
        }

    def _process_markdown(self, file_path: str) -> Dict:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
        # 解析Markdown标题
        headers = re.findall(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE)
        chapters = []
        current_chapter = None
        last_position = 0
        
        for header in headers:
            level = len(header[0])
            title = header[1]
            
            if current_chapter:
                current_chapter['content'] = content[last_position:content.find('#' * level + ' ' + title)]
                chapters.append(current_chapter)
                
            current_chapter = {
                'title': title,
                'level': level,
                'content': ''
            }
            last_position = content.find('#' * level + ' ' + title) + len('#' * level + ' ' + title)

        if current_chapter:
            current_chapter['content'] = content[last_position:]
            chapters.append(current_chapter)

        return {
            'metadata': {
                'title': os.path.basename(file_path),
                'created': datetime.fromtimestamp(os.path.getctime(file_path)).isoformat(),
                'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
            },
            'toc': [{'title': c['title'], 'level': c['level']} for c in chapters],
            'chapters': chapters
        }

    def _process_generic(self, file_path: str) -> Dict:
        """处理其他格式文件，尝试基于内容分析创建章节"""
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()

        # 尝试按空行分割段落
        paragraphs = content.split('\n\n')
        chapters = [{
            'title': f'第{i+1}部分',
            'level': 1,
            'content': para.strip()
        } for i, para in enumerate(paragraphs) if para.strip()]

        return {
            'metadata': {
                'title': os.path.basename(file_path),
                'created': datetime.fromtimestamp(os.path.getctime(file_path)).isoformat(),
                'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
            },
            'toc': [{'title': c['title'], 'level': c['level']} for c in chapters],
            'chapters': chapters
        }

    def save_structure(self, doc_id: str, structure: Dict, cache_dir: str):
        """保存文档结构到缓存"""
        os.makedirs(cache_dir, exist_ok=True)
        structure_file = os.path.join(cache_dir, f"{doc_id}_structure.json")
        
        with open(structure_file, 'w', encoding='utf-8') as f:
            json.dump(structure, f, ensure_ascii=False, indent=2)

    def load_structure(self, doc_id: str, cache_dir: str) -> Optional[Dict]:
        """从缓存加载文档结构"""
        structure_file = os.path.join(cache_dir, f"{doc_id}_structure.json")
        if os.path.exists(structure_file):
            with open(structure_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
