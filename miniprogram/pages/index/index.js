const app = getApp();

Page({
  data: {
    inputText: '',
    hasContent: false,
    fileInfo: null,
    bionicEnabled: true,
    fileName: '',
    tempFilePath: '',
    fileSize: '',
    loading: false
  },

  onInputChange(e) {
    this.setData({
      inputText: e.detail.value,
      hasContent: e.detail.value.trim().length > 0
    });
  },

  toggleBionic() {
    this.setData({
      bionicEnabled: !this.data.bionicEnabled
    });
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['doc', 'docx', 'pdf', 'txt'],
      success: (res) => {
        const file = res.tempFiles[0];
        
        // 检查文件大小（5MB限制）
        if (file.size > 5 * 1024 * 1024) {
          wx.showToast({
            title: '文件过大，请选择小于5MB的文件',
            icon: 'none',
            duration: 2000
          });
          return;
        }

        this.setData({
          fileName: file.name,
          tempFilePath: file.path,
          fileSize: (file.size / 1024).toFixed(2) + 'KB',
          fileInfo: file,
          hasContent: true
        });
      }
    });
  },

  async startReading() {
    if (!this.data.hasContent) {
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '处理中...' });

    try {
      let content = '';
      
      if (this.data.fileInfo) {
        // 上传文件到服务器处理
        const uploadResult = await this.uploadFile(this.data.fileInfo);
        content = uploadResult.content;
      } else {
        // 直接处理输入的文本
        content = this.data.inputText;
      }

      // 跳转到阅读页面
      const encodedContent = encodeURIComponent(content);
      wx.navigateTo({
        url: `/pages/reader/reader?text=${encodedContent}&bionicEnabled=${this.data.bionicEnabled}`
      });

    } catch (error) {
      console.error('处理失败:', error);
      wx.showToast({
        title: error.message || '处理失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // 上传文件到服务器
  uploadFile(fileInfo) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: 'http://localhost:8000/api/parse',  // 更新为Python服务器地址
        filePath: fileInfo.path,
        name: 'file',
        formData: {
          bionic_enabled: this.data.bionicEnabled
        },
        success: (res) => {
          try {
            const result = JSON.parse(res.data);
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(result.error || '文件处理失败'));
            }
          } catch (error) {
            reject(new Error('服务器响应解析失败'));
          }
        },
        fail: (error) => {
          reject(new Error('文件上传失败: ' + error.errMsg));
        }
      });
    });
  },

  clearContent() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除当前内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            inputText: '',
            fileInfo: null,
            hasContent: false,
            fileName: '',
            tempFilePath: '',
            fileSize: ''
          });
        }
      }
    });
  }
});
