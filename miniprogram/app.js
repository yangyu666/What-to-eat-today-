const cloudConfig = {
  envId: 'cloud1-d7g5ft07k29226d0e'
};

App({
  globalData: {
    cloudReady: false,
    userInfo: null
  },

  onLaunch() {
    this.initCloud();
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('当前基础库不支持云开发能力');
      return;
    }

    wx.cloud.init({
      env: cloudConfig.envId || undefined,
      traceUser: true
    });

    this.globalData.cloudReady = true;
  }
});
