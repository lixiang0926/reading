const express = require('express');
const multer = require('multer');
const cors = require('cors');
const morgan = require('morgan');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// 配置文件上传
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 处理Word文档
async function processWord(filePath) {
  try {
    const result = await mammoth.convertToHtml({
      path: filePath
    }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p => p:fresh"
      ],
      ignoreEmptyParagraphs: true
    });
    return result.value;
  } catch (error) {
    throw new Error('Word文档处理失败: ' + error.message);
  }
}

// 处理PDF文档
async function processPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text.split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${line}</p>`)
      .join('');
  } catch (error) {
    throw new Error('PDF文档处理失败: ' + error.message);
  }
}

// 处理文本文件
function processTxt(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${line}</p>`)
      .join('');
  } catch (error) {
    throw new Error('文本文件处理失败: ' + error.message);
  }
}

// 文件上传和处理接口
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let content = '';

    switch (fileExt) {
      case '.doc':
      case '.docx':
        content = await processWord(filePath);
        break;
      case '.pdf':
        content = await processPdf(filePath);
        break;
      case '.txt':
        content = processTxt(filePath);
        break;
      default:
        throw new Error('不支持的文件格式');
    }

    // 清理临时文件
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      content,
      filename: req.file.originalname,
      fileSize: req.file.size
    });

  } catch (error) {
    console.error('文件处理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '文件处理失败'
    });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
