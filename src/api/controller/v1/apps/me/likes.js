/* eslint-disable no-undef */
const BaseRest = require('../Base');
module.exports = class extends BaseRest {
  /**
   * 获取我喜欢的全部内容
   *
   * @returns {Promise.<*>}
   */
  async indexAction () {
    const userMeta = this.model('usermeta')
    const userId = this.ctx.state.user.id
    let data = await userMeta.where(`meta_key = 'picker_${this.appId}_liked_posts' and user_id = ${userId}`).find()
    if (!think.isEmpty((data))) {
      data.meta_value = JSON.parse(data.meta_value)
      let items = []
      for (let item of data.meta_value) {
        items.push(item.post_id)
      }
      const list = await this.model('posts', {appId: this.appId}).getItems(items)
      _formatMeta(list)
      let thumbnailIds = []
      for (let item of list) {
        if (!Object.is(item.meta, undefined) && !Object.is(item.meta._thumbnail_id, undefined)) {
          thumbnailIds.push(item.meta._thumbnail_id)
        }
      }
      // 查询出图片地址
      let images = await this.model('postmeta', {appId: this.appId}).getAttachments(thumbnailIds)
      for (let imgItem of images) {
        for (let item of list) {
          // if (!Object.is(item.meta, undefined) && !Object.is(item.meta._thumbnail_id, undefined)) {
          //   break
          // }
          if (item.meta._thumbnail_id === imgItem.post_id) {
            item.featured_image = JSON.parse(imgItem.meta_value)
          }
        }
      }

      for (let groupItem of data.meta_value) {
        for (let item of list) {
          if (!Object.is(item.meta, undefined) && !Object.is(item.meta._liked, undefined)) {
            item.like_count = item.meta._liked.length
          }
          if (groupItem.post_id === item.id.toString()) {
            Reflect.deleteProperty(item, 'date')
            Reflect.deleteProperty(item, 'meta')
            groupItem = Object.assign(groupItem, item)
          }
        }
      }
      const myData = think._.groupBy(data.meta_value, 'date')
      return this.success(myData)
      // return this.success({found: data.meta_value.length, likes: data.meta_value})
    } else {
      return this.success({found: 0})
    }
  }
}
