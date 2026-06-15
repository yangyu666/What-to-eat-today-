Component({
  data: {
    items: []
  },
  lifetimes: {
    created() {
      if (!wx.modelContext) {
        return
      }

      this._modelCtx = wx.modelContext.getContext(this)
      const { NotificationType } = wx.modelContext

      this._modelCtx.on(NotificationType.Result, (data) => {
        const result = data && data.result ? data.result : {}
        const sc = result.structuredContent || {}

        this.setData({
          items: Array.isArray(sc.items) ? sc.items : []
        })
      })
    }
  }
})
