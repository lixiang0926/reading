class BionicReader {
  constructor(options = {}) {
    this.options = {
      chineseRatio: options.chineseRatio || 1,
      englishRatio: options.englishRatio || 0.4,
      minLength: options.minLength || 3,
      skipCommonWords: options.skipCommonWords !== false,
      chunkSize: options.chunkSize || 1000
    };

    // 常用词列表
    this.commonWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she'
    ]);
  }

  // 处理文本
  processText(text) {
    const segments = this.segmentText(text);
    return segments.map(segment => {
      if (segment.type === 'chinese') {
        return this.processChineseSegment(segment.text);
      } else if (segment.type === 'english') {
        return this.processEnglishSegment(segment.text);
      }
      return segment.text;
    }).join('');
  }

  // 文本分段
  segmentText(text) {
    const segments = [];
    let currentSegment = '';
    let currentType = null;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const type = this.getCharType(char);
      
      if (type !== currentType && currentSegment) {
        segments.push({ text: currentSegment, type: currentType });
        currentSegment = '';
      }
      
      currentSegment += char;
      currentType = type;
    }
    
    if (currentSegment) {
      segments.push({ text: currentSegment, type: currentType });
    }
    
    return segments;
  }

  // 获取字符类型
  getCharType(char) {
    if (/[\u4e00-\u9fa5]/.test(char)) return 'chinese';
    if (/[a-zA-Z]/.test(char)) return 'english';
    return 'other';
  }

  // 处理中文片段
  processChineseSegment(text) {
    // 简单的中文分词：按标点符号和空格分割
    const words = text.split(/([，。！？；：、\s])/);
    return words.map(word => {
      if (!word || /[，。！？；：、\s]/.test(word)) {
        return word;
      }
      
      if (word.length === 1) {
        return `<b>${word}</b>`;
      }
      
      // 根据词长动态调整加粗比例
      const ratio = this.calculateChineseBoldRatio(word.length);
      const prefixLength = Math.ceil(word.length * ratio);
      
      return `<b>${word.slice(0, prefixLength)}</b>${word.slice(prefixLength)}`;
    }).join('');
  }

  // 处理英文片段
  processEnglishSegment(text) {
    return text.split(/\b/).map(word => {
      if (!word.trim() || !(/[a-zA-Z]/.test(word))) {
        return word;
      }
      
      // 跳过常用词
      if (this.options.skipCommonWords && this.commonWords.has(word.toLowerCase())) {
        return word;
      }
      
      // 根据词长动态调整加粗比例
      const ratio = this.calculateEnglishBoldRatio(word.length);
      const prefixLength = Math.ceil(word.length * ratio);
      
      return `<b>${word.slice(0, prefixLength)}</b>${word.slice(prefixLength)}`;
    }).join('');
  }

  // 计算中文加粗比例
  calculateChineseBoldRatio(length) {
    return Math.max(
      0.3,
      Math.min(1, this.options.chineseRatio / Math.log2(length + 1))
    );
  }

  // 计算英文加粗比例
  calculateEnglishBoldRatio(length) {
    return Math.max(
      0.3,
      Math.min(0.5, this.options.englishRatio / Math.log2(length + 1))
    );
  }
}

module.exports = BionicReader;
