Component({
  data: {
    candidateId: '',
    restaurantId: '',
    name: '',
    distanceText: '',
    estimatedMinutes: 0,
    averageCost: 0,
    matchPercent: 0,
    tags: [],
    reasons: [],
    fallbackReason: '',
    source: '',
    candidatePoolStats: {}
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
          candidateId: sc.candidateId || '',
          restaurantId: sc.restaurantId || '',
          name: sc.name || '',
          distanceText: sc.distanceText || '',
          estimatedMinutes: sc.estimatedMinutes || 0,
          averageCost: sc.averageCost || 0,
          matchPercent: sc.matchPercent || 0,
          tags: Array.isArray(sc.tags) ? sc.tags : [],
          reasons: Array.isArray(sc.reasons) ? sc.reasons : [],
          fallbackReason: sc.fallbackReason || '',
          source: sc.source || '',
          candidatePoolStats: sc.candidatePoolStats || {}
        })
      })
    }
  },
  methods: {
    acceptFood() {
      if (!this._modelCtx || !this.data.candidateId || !this.data.restaurantId) {
        return
      }

      this._modelCtx.sendFollowUpMessage({
        content: [
          { type: 'text', text: `就吃${this.data.name}` },
          {
            type: 'api/call',
            data: {
              name: 'acceptFood',
              arguments: {
                candidateId: this.data.candidateId,
                restaurantId: this.data.restaurantId,
                name: this.data.name
              }
            }
          }
        ]
      })
    },
    changeFood() {
      if (!this._modelCtx || !this.data.candidateId) {
        return
      }

      this._modelCtx.sendFollowUpMessage({
        content: [
          { type: 'text', text: '换一家' },
          {
            type: 'api/call',
            data: {
              name: 'changeFood',
              arguments: {
                previousCandidateId: this.data.candidateId,
                reason: '用户点击推荐卡片换一个',
                historyFilterEnabled: true
              }
            }
          }
        ]
      })
    }
  }
})
