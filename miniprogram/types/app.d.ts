interface IAppOption {
  globalData: {
    cloudReady: boolean;
    userInfo: WechatMiniprogram.UserInfo | null;
  };
  initCloud(): void;
}
