// fileParser.js
const API_BASE_URL = 'http://localhost:8000/api';  // 开发环境
// const API_BASE_URL = 'https://your-production-domain.com/api';  // 生产环境

class FileParser {
  constructor() {
    this.apiBaseUrl = API_BASE_URL;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
  }

  // 检查文件大小
  checkFileSize(size) {
    if (size > this.maxFileSize) {
      throw new Error('文件过大，请选择小于5MB的文件');
    }
  }

  // 读取文本文件
  async readTextFile(filePath) {
    try {
      const fs = wx.getFileSystemManager();
      const content = fs.readFileSync(filePath, 'utf8');
      return await this.parseFile(content);
    } catch (error) {
      console.error('读取文本文件失败:', error);
      throw new Error('读取文件失败: ' + error.message);
    }
  }

  async parseFile(fileContent) {
    try {
      const response = await wx.request({
        url: `${this.apiBaseUrl}/parse`,
        method: 'POST',
        data: {
          content: fileContent
        },
        header: {
          'content-type': 'application/json'
        }
      });

      if (response.statusCode === 200 && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || '解析失败');
      }
    } catch (error) {
      console.error('File parsing error:', error);
      throw error;
    }
  }

  async processTextContent(content) {
    const paragraphs = await this.parseFile(content);
    return paragraphs;
  }

  async processBionicReading(text) {
    try {
      const response = await wx.request({
        url: `${this.apiBaseUrl}/bionic`,
        method: 'POST',
        data: {
          text: text
        },
        header: {
          'content-type': 'application/json'
        }
      });

      if (response.statusCode === 200 && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || '处理失败');
      }
    } catch (error) {
      console.error('Bionic reading processing error:', error);
      throw error;
    }
  }

  // 处理长文本，分段加载
  async processLongText(text, startIndex = 0, length = 1000) {
    const paragraphs = text.split('\n')
      .filter(p => p.trim().length > 0);
    
    const truncatedParagraphs = paragraphs.slice(startIndex, startIndex + length);
    
    if (truncatedParagraphs.length === 0) {
      return null;
    }

    return {
      content: truncatedParagraphs,
      hasMore: startIndex + length < paragraphs.length,
      nextIndex: startIndex + length
    };
  }

  // 截断过长的内容
  truncateContent(paragraphs, maxLength = 100000) {
    let totalLength = 0;
    const truncatedParagraphs = [];

    for (const paragraph of paragraphs) {
      if (totalLength + paragraph.length > maxLength) {
        truncatedParagraphs.push('...(内容已截断，仅显示部分内容)');
        break;
      }
      truncatedParagraphs.push(paragraph);
      totalLength += paragraph.length;
    }

    return truncatedParagraphs;
  }
}

module.exports = FileParser;
