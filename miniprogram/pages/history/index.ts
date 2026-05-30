import type { MealHistoryItem } from '../../models/meal';

Page({
  data: {
    history: [
      {
        id: 'demo-1',
        mealName: '番茄牛肉面',
        dateText: '今天',
        note: '项目骨架占位数据'
      },
      {
        id: 'demo-2',
        mealName: '照烧鸡腿饭',
        dateText: '昨天'
      }
    ] as MealHistoryItem[]
  }
});
