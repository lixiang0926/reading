const app = getApp()

Page({
  data: {
    content: '',
    metadata: {},
    structure: {},
    bookmarks: [],
    currentChapter: null,
    loading: false,
    showMenu: false,
    showSettings: false,
    activeTab: 'toc',
    darkMode: false,
    bionicEnabled: true,
    fontSize: 16,
    lineHeight: 1.6,
    scrollTop: 0,
    currentProgress: '0%'
  },

  onLoad: function(options) {
    const { docId, userId } = options
    this.docId = docId
    this.userId = userId
    
    // 加载文档结构
    this.loadDocumentStructure()
    // 加载书签
    this.loadBookmarks()
    // 恢复阅读进度
    this.restoreReadingProgress()
    
    // 加载用户设置
    const settings = wx.getStorageSync('reader_settings') || {}
    this.setData({
      darkMode: settings.darkMode || false,
      bionicEnabled: settings.bionicEnabled !== false,
      fontSize: settings.fontSize || 16,
      lineHeight: settings.lineHeight || 1.6
    })
    
    // 更新CSS变量
    this.updateCSSVariables()
  },

  async loadDocumentStructure() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getDocumentStructure',
        data: {
          docId: this.docId
        }
      })
      
      if (res.result.success) {
        this.setData({
          metadata: res.result.structure.metadata,
          structure: res.result.structure
        })
        
        // 加载第一章
        if (res.result.structure.toc.length > 0) {
          this.loadChapter(res.result.structure.toc[0])
        }
      }
    } catch (error) {
      wx.showToast({
        title: '加载文档结构失败',
        icon: 'none'
      })
    }
  },

  async loadChapter(chapter) {
    this.setData({ loading: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'getChapterContent',
        data: {
          docId: this.docId,
          chapterId: chapter.id,
          userId: this.userId,
          bionicEnabled: this.data.bionicEnabled
        }
      })
      
      if (res.result.success) {
        this.setData({
          content: res.result.content,
          currentChapter: chapter,
          loading: false,
          scrollTop: 0
        })
      }
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: '加载章节失败',
        icon: 'none'
      })
    }
  },

  async loadBookmarks() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBookmarks',
        data: {
          docId: this.docId,
          userId: this.userId
        }
      })
      
      if (res.result.success) {
        this.setData({
          bookmarks: res.result.bookmarks
        })
      }
    } catch (error) {
      wx.showToast({
        title: '加载书签失败',
        icon: 'none'
      })
    }
  },

  async addBookmark() {
    const position = {
      chapter: this.data.currentChapter.id,
      scrollTop: this.data.scrollTop
    }
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'addBookmark',
        data: {
          docId: this.docId,
          userId: this.userId,
          position: position
        }
      })
      
      if (res.result.success) {
        wx.showToast({
          title: '添加书签成功',
          icon: 'success'
        })
        this.loadBookmarks()
      }
    } catch (error) {
      wx.showToast({
        title: '添加书签失败',
        icon: 'none'
      })
    }
  },

  async restoreReadingProgress() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getProgress',
        data: {
          docId: this.docId,
          userId: this.userId
        }
      })
      
      if (res.result.success && res.result.progress) {
        const { chapter, scrollTop } = res.result.progress
        // 找到对应章节
        const targetChapter = this.findChapter(chapter)
        if (targetChapter) {
          await this.loadChapter(targetChapter)
          this.setData({ scrollTop })
        }
      }
    } catch (error) {
      console.error('恢复阅读进度失败:', error)
    }
  },

  findChapter(chapterId) {
    return this.data.structure.toc.find(c => c.id === chapterId)
  },

  onScroll(e) {
    // 更新阅读进度
    const { scrollTop, scrollHeight } = e.detail
    const progress = Math.round((scrollTop / scrollHeight) * 100)
    this.setData({
      scrollTop,
      currentProgress: `${progress}%`
    })
  },

  toggleMenu() {
    this.setData({
      showMenu: !this.data.showMenu
    })
  },

  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  jumpToChapter(e) {
    const { chapter } = e.currentTarget.dataset
    this.loadChapter(chapter)
    this.toggleMenu()
  },

  jumpToBookmark(e) {
    const { bookmark } = e.currentTarget.dataset
    const chapter = this.findChapter(bookmark.chapter)
    if (chapter) {
      this.loadChapter(chapter).then(() => {
        this.setData({
          scrollTop: bookmark.scrollTop
        })
      })
    }
    this.toggleMenu()
  },

  toggleDarkMode() {
    this.setData({
      darkMode: !this.data.darkMode
    })
    this.saveSettings()
  },

  showSettings() {
    this.setData({
      showSettings: true
    })
  },

  hideSettings() {
    this.setData({
      showSettings: false
    })
  },

  toggleBionic(e) {
    const bionicEnabled = e.detail.value
    this.setData({ bionicEnabled })
    // 重新加载当前章节
    if (this.data.currentChapter) {
      this.loadChapter(this.data.currentChapter)
    }
    this.saveSettings()
  },

  changeFontSize(e) {
    const fontSize = e.detail.value
    this.setData({ fontSize })
    this.updateCSSVariables()
    this.saveSettings()
  },

  changeLineHeight(e) {
    const lineHeight = e.detail.value
    this.setData({ lineHeight })
    this.updateCSSVariables()
    this.saveSettings()
  },

  updateCSSVariables() {
    const root = wx.createSelectorQuery().select('.reader-container')
    root.fields({
      computedStyle: ['--font-size', '--line-height']
    }, function(res) {
      wx.createSelectorQuery().select('.reader-container').node(function(res) {
        const container = res.node
        container.style.setProperty('--font-size', `${this.data.fontSize}px`)
        container.style.setProperty('--line-height', this.data.lineHeight)
      }.bind(this)).exec()
    }.bind(this)).exec()
  },

  saveSettings() {
    const settings = {
      darkMode: this.data.darkMode,
      bionicEnabled: this.data.bionicEnabled,
      fontSize: this.data.fontSize,
      lineHeight: this.data.lineHeight
    }
    wx.setStorageSync('reader_settings', settings)
  },

  goBack() {
    wx.navigateBack()
  },

  onUnload() {
    // 保存阅读进度
    if (this.data.currentChapter) {
      wx.cloud.callFunction({
        name: 'saveProgress',
        data: {
          docId: this.docId,
          userId: this.userId,
          progress: {
            chapter: this.data.currentChapter.id,
            scrollTop: this.data.scrollTop
          }
        }
      })
    }
  }
})
