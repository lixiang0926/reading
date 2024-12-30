// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'reading-1gtah56qcfb6fe2b', // 使用你的云环境ID
        traceUser: true,
      });
    }
  },
  globalData: {
    userInfo: null
  }
});
