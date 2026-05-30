import type { PreferenceOption } from '../../models/meal';

Page({
  data: {
    options: [
      { id: 'light', label: '清淡', selected: true },
      { id: 'spicy', label: '辣一点', selected: false },
      { id: 'quick', label: '30 分钟内', selected: true },
      { id: 'meat', label: '想吃肉', selected: false },
      { id: 'vegetable', label: '多点蔬菜', selected: false }
    ] as PreferenceOption[]
  },

  toggleOption(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string };
    const options = this.data.options.map((option) => {
      if (option.id !== id) {
        return option;
      }

      return {
        ...option,
        selected: !option.selected
      };
    });

    this.setData({ options });
  }
});
