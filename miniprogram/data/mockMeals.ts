import type { MealCandidate } from '../models/meal';

export const mockMeals: MealCandidate[] = [
  {
    id: 'tomato-beef-noodle',
    name: '番茄牛肉面',
    tags: ['热乎', '酸甜', '主食'],
    reason: '酸甜开胃，准备时间短，适合不知道吃什么的时候快速定下来。',
    estimatedMinutes: 25
  },
  {
    id: 'chicken-rice',
    name: '照烧鸡腿饭',
    tags: ['下饭', '肉类', '便当'],
    reason: '口味稳定，食材常见，也适合提前备菜。',
    estimatedMinutes: 35
  },
  {
    id: 'mushroom-risotto',
    name: '菌菇烩饭',
    tags: ['清淡', '素食友好', '暖胃'],
    reason: '香气足但负担轻，适合想吃得舒服一点的日子。',
    estimatedMinutes: 30
  }
];
