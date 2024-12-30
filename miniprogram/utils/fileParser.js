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
      return this.processTextContent(content);
    } catch (error) {
      console.error('读取文本文件失败:', error);
      throw new Error('读取文件失败: ' + error.message);
    }
  }

  // 处理文本内容
  processTextContent(content) {
    // 移除空行并格式化
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 将内容分成段落
    const paragraphs = [];
    let currentParagraph = '';

    for (const line of lines) {
      if (line.length < 40 && line.endsWith('.')) {
        // 可能是标题
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
        paragraphs.push(line);
      } else {
        if (currentParagraph) {
          currentParagraph += ' ';
        }
        currentParagraph += line;

        // 如果行以句号结束，或者累积的段落太长，就开始新段落
        if (line.endsWith('.') || currentParagraph.length > 1000) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
      }
    }

    // 添加最后一个段落
    if (currentParagraph) {
      paragraphs.push(currentParagraph);
    }

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
}

module.exports = FileParser;
