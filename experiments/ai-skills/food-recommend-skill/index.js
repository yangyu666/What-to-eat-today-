const recommendFood = require('./apis/recommendFood.js')
const changeFood = require('./apis/changeFood.js')
const acceptFood = require('./apis/acceptFood.js')
const getRecentRecommendations = require('./apis/getRecentRecommendations.js')

const skill = wx.modelContext.createSkill('skills/food-recommend-skill')

skill.registerAPI('recommendFood', recommendFood)
skill.registerAPI('changeFood', changeFood)
skill.registerAPI('acceptFood', acceptFood)
skill.registerAPI('getRecentRecommendations', getRecentRecommendations)

console.log('[food-recommend-skill] APIs registered')
