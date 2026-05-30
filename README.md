# 今天吃什么

微信小程序项目骨架，基于微信小程序原生、TypeScript 和微信云开发。

## 项目结构

```text
.
├── cloudfunctions/          # 云函数预留目录
├── miniprogram/             # 小程序源码
│   ├── app.json             # 全局配置与页面路由
│   ├── app.ts               # 小程序入口
│   ├── app.wxss             # 全局样式
│   ├── pages/               # 页面
│   ├── services/            # 业务服务，后续接云函数/API
│   ├── models/              # 领域模型
│   ├── types/               # 全局类型声明
│   ├── utils/               # 通用工具
│   └── styles/              # 样式变量
├── project.config.json      # 微信开发者工具项目配置
└── tsconfig.json            # TypeScript 配置
```

## 本地开发

1. 使用微信开发者工具导入当前目录。
2. AppID 可以先使用测试号或在 `project.private.config.json` 中配置自己的 AppID。
3. 云开发环境 ID 暂未写死，后续在 `miniprogram/config/cloud.ts` 中按环境补充。
4. 当前推荐结果来自本地 Mock 数据，后续将 `miniprogram/services/mealService.ts` 替换为云函数调用即可。

## 页面路由

- `pages/home/index`：今日推荐首页
- `pages/preferences/index`：口味偏好
- `pages/history/index`：历史记录
- `pages/mine/index`：我的
