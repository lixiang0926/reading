// fileParser.js
class FileParser {
  constructor() {
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

  // 解析文件内容
  async parseFile(fileContent) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'parseFile',
        data: {
          fileContent: fileContent
        }
      });
      
      if (result.result && result.result.success) {
        return result.result.data;
      } else {
        throw new Error(result.result.error || '解析失败');
      }
    } catch (error) {
      console.error('File parsing error:', error);
      throw error;
    }
  }

  // 处理文本内容
  async processTextContent(content) {
    const paragraphs = await this.parseFile(content);
    return paragraphs;
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

  // 处理生理阅读
  async processBionicReading(text) {
    return wx.cloud.callFunction({
      name: 'bionicReading',
      data: {
        text: text
      }
    }).then(res => {
      if (res.result && res.result.success) {
        return res.result.data;
      } else {
        throw new Error(res.result.error || '处理失败');
      }
    });
  }
}

module.exports = FileParser;
