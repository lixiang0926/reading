const cloud = require('wx-server-sdk');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 文件大小限制（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 获取文件扩展名
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// 处理Word文档
async function processWord(buffer) {
  try {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('文件过大，请上传小于5MB的文件');
    }

    const result = await mammoth.convertToHtml(buffer, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p => p:fresh"
      ],
      ignoreEmptyParagraphs: true,
      preserveNumbering: false,
      convertImage: mammoth.images.dataUri({
        maxSize: 500 * 1024 // 限制图片大小为500KB
      })
    });
    
    return {
      content: result.value,
      type: 'html'
    };
  } catch (error) {
    throw new Error('无法解析Word文档: ' + error.message);
  }
}

// 处理PDF文档
async function processPdf(buffer) {
  try {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('文件过大，请上传小于5MB的文件');
    }

    const options = {
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let text = '';
          let lastY;
          for (let item of textContent.items) {
            if (lastY !== item.transform[5]) {
              text += '\n';
            }
            text += item.str;
            lastY = item.transform[5];
          }
          return text;
        });
      },
      max: 20, // 限制为前20页
      version: 'v2.0.550'
    };

    const data = await pdf(buffer, options);
    const content = data.text.split('\n')
      .filter(line => line.trim()) // 移除空行
      .map(line => `<p>${line}</p>`)
      .join('');

    return {
      content,
      type: 'html',
      pageCount: Math.min(data.numpages, 20)
    };
  } catch (error) {
    throw new Error('无法解析PDF文档: ' + error.message);
  }
}

// 处理TXT文档
function processTxt(buffer) {
  try {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('文件过大，请上传小于5MB的文件');
    }

    const text = buffer.toString('utf8');
    const content = text.split('\n')
      .filter(line => line.trim()) // 移除空行
      .map(line => `<p>${line}</p>`)
      .join('');

    return {
      content,
      type: 'html'
    };
  } catch (error) {
    throw new Error('无法解析TXT文档: ' + error.message);
  }
}

// 截断HTML内容
function truncateHtml(html, maxLength = 100000) {
  if (html.length <= maxLength) return html;
  
  // 找到最后一个完整的段落
  const truncated = html.substring(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('</p>');
  
  if (lastParagraph === -1) return truncated + '...</p>';
  return truncated.substring(0, lastParagraph + 4) + 
    '<p>...(内容已截断，仅显示部分内容)</p>';
}

exports.main = async (event, context) => {
  try {
    const { fileID, enableBionic = false } = event;
    
    // 下载云存储中的文件
    const res = await cloud.downloadFile({
      fileID: fileID,
    });
    
    const buffer = res.fileContent;
    const fileInfo = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    const filename = fileInfo.fileList[0].tempFileURL.split('/').pop();
    const extension = getFileExtension(filename);
    
    // 检查文件大小
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('文件过大，请上传小于5MB的文件');
    }
    
    let result = null;
    
    // 根据文件类型选择相应的处理方法
    switch (extension) {
      case 'doc':
      case 'docx':
        result = await processWord(buffer);
        break;
      case 'pdf':
        result = await processPdf(buffer);
        break;
      case 'txt':
        result = processTxt(buffer);
        break;
      default:
        throw new Error('不支持的文件格式');
    }
    
    // 截断过长的内容
    result.content = truncateHtml(result.content);
    
    // 删除临时文件
    await cloud.deleteFile({
      fileList: [fileID]
    });
    
    return {
      ...result,
      filename,
      extension,
      enableBionic,
      fileSize: buffer.length
    };
    
  } catch (error) {
    console.error('文件处理失败:', error);
    throw error;
  }
};
