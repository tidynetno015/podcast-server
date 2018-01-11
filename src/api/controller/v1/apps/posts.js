/* eslint-disable no-undef,no-return-await,default-case,max-depth,no-warning-comments,comma-spacing */
const BaseRest = require('./Base')
const slug = require('limax')

let fields = [
  'id',
  'author',
  'status',
  'type',
  'title',
  'name',
  'content',
  'sort',
  'excerpt',
  'date',
  'modified',
  'parent'
]

module.exports = class extends BaseRest {
  async indexAction () {
    // 格式旧数据用的
    const data = await this.getAllFromPage()
    return this.success(data)
  }
  async getAction () {
    const format = this.get('format')
    const termId = this.get('term_id')
    const termSlug = this.get('term_slug')

    if (!think.isEmpty(termSlug)) {
      // 根据 slug 取 termId
      const term = await this.model('taxonomy', {appId: this.appId}).getTermBySlug(termSlug)
      if (!think.isEmpty(term)) {
        const objects = await this.getObjectsInTerms(term.id)
        return this.success(objects)
      } else {
        return this.success()
      }
    }
    // 查询内容按分类 id 为首页使用 查询 6 条
    if (!think.isEmpty(termId)) {
      const objects = await this.getObjectsInTermsByLimit(termId)
      return this.success(objects)
    }

    // 查询全部分类按分类方法
    const taxonomy = this.get('term')
    if (!think.isEmpty(taxonomy)) {
      const terms = await this.model('taxonomy', {appId: this.appId}).getTerms(taxonomy)
      let cates = []
      terms.forEach((value) => {
        cates.push(value.id)
      })
      const objects = await this.getObjectsInTerms(cates, this.get('page'))
      return this.success(objects)
    }

    const id = this.get('id')
    if (!think.isEmpty(id)) {
      let fields = [
        'id',
        'author',
        'status',
        'type',
        'title',
        'name',
        'content',
        'sort',
        'excerpt',
        'date',
        'modified',
        'parent'
      ];
      fields = unique(fields);

      let query = {}
      query.id = id
      query = {status: ['NOT IN', 'trash'], id: id}
      return await this.getPodcast(query, fields)
    }

    const parent = this.get('parent')
    let query = {}
    if (!think.isEmpty(parent)) {
      query.parent = parent
      query.status = ['NOT IN', 'trash']
      const status = this.get('status')

      if (!think.isEmpty(status)) {
        query.status = status
        if (query.status === 'my') {
          // query.status = ['NOT IN', 'trash']
          query.author = this.ctx.state.user.id
        }
        if (query.status === 'drafts') {
          query.status = ['like', '%draft%']
        }
      }
      return await this.getPodcastList(query, fields)
    }

    const data = await this.getAllFromPage()
    return this.success(data)
  }

  /**
   * 按分类查找
   * @param termIds
   * @param page
   * @returns {Promise.<Object>}
   */
  async getObjectsInTerms (termIds, page) {
    const userId = this.ctx.state.user.id
    const _post = this.model('posts', {appId: this.appId})
    const data = await _post.getList(termIds, page, this.get('status'))
    if (!think.isEmpty(data)) {
      const metaModel = this.model('postmeta', {appId: this.appId})
      _formatMeta(data.data)

      for (const item of data.data) {
        item.url = ''
        const userModel = this.model('users');
        // 如果有作者信息
        if (!Object.is(item.meta._author_id, undefined)) {
          const authorInfo = await userModel.where({id: item.meta._author_id}).find()
          item.authorInfo = authorInfo
          // 查询 出对应的作者信息
        } else {
          item.authorInfo = await userModel.where({id: item.author}).find()
        }
        _formatOneMeta(item.authorInfo)
        if (item.authorInfo.hasOwnProperty('meta')) {
          if (item.authorInfo.meta.hasOwnProperty('avatar')) {
            item.authorInfo.avatar = await metaModel.getAttachment('file', item.authorInfo.meta.avatar)
          }
        }
        // TODO: @basil 1030这部分数据需要处理，减少 SQL 查询
        // "likes_enabled": true,
        //   "sharing_enabled": true,
        // 获取收藏/喜欢 的数量
        item.like_count = await metaModel.getLikedCount(item.id)
        // 获取当前用户是否喜欢
        const iLike = await metaModel.getLikeStatus(userId, item.id)
        item.i_like = iLike.contain > 0
        item.likes_enabled = true
        item.sharing_enabled = true
        // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
        if (!Object.is(item.meta._thumbnail_id, undefined)) {
          item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        }
      }
      return data
    }
  }

  async getObjectsInTermsByLimit (terms) {
    const taxonomyModel = this.model('taxonomy', {appId: this.appId})
    const objects = await taxonomyModel.getObjectsInTermsByLimit(terms)
    if (!think.isEmpty(objects)) {
      const postsModel = this.model('posts', {appId: this.appId})
      const podcasts = await postsModel.where({id: ['IN', objects]}).select();
      const metaModel = this.model('postmeta', {appId: this.appId})
      _formatMeta(podcasts)

      for (const item of podcasts) {
        item.url = ''
        const userModel = this.model('users');
        // 如果有作者信息
        if (!Object.is(item.meta._author_id, undefined)) {
          const authorInfo = await userModel.where({id: item.meta._author_id}).find()
          item.authorInfo = authorInfo
          // 查询 出对应的作者信息
        } else {
          item.authorInfo = await userModel.where({id: item.author}).find()
        }

        // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
        if (!Object.is(item.meta._thumbnail_id, undefined)) {
          item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        }
      }

      return podcasts
    }
    return []
  }

  async getAllFromPage () {
    let query = {}
    const title = this.get('title')
    const author = this.get('author')
    if (!think.isEmpty(author)) {
      query.author = author
    }
    // date query
    const status = this.get('status')
    if (think.isEmpty(status) || status === 'all') {
      query.status = ['NOT IN', 'trash']
    } else {
      query.status = status
    }
    query.parent = !think.isEmpty(this.get('parent')) ? this.get('parent') : 0
    query.type = !think.isEmpty(this.get('type')) ? this.get('type') : 'post_format'
    // query.sticky = fals
    // query.sticky = this.get('sticky')
    let list = []
    const category = this.get('category')
    // if (!think.isEmpty(category)) {
    //
    // }
    if (!think.isEmpty(category)) {
      // list = await this.model('posts', {appId: this.appId}).findByCategory(category, this.get('page'), this.get('pagesize') ? this.get('pagesize') : 100)
      list = await this.model('posts', {appId: this.appId}).findByCategory(category, this.get('page'), 12)
      // return list
      // console.log(JSON.stringify(list))
    } else if (this.get('sticky') === 'true') {
      const stickys = this.options.stickys
      list = await this.model('posts', {appId: this.appId}).getStickys(stickys)

    } else {
      list = await this.model('posts', {appId: this.appId}).where(query).field(fields.join(",")).order('sort ASC').page(this.get('page'), this.get('pagesize') ? this.get('pagesize') : 30).countSelect()
    }
    _formatMeta(list.data)
    const metaModel = this.model('postmeta', {appId: this.appId})

    // if (!think.isEmpty(data.items)) {
    //   data.meta = {
    //     '_items': JSON.stringify(data.items)
    //   }
    //   await metaModel.save(this.id, data.meta)
    // }
    for (const item of list.data) {
      if (!Object.is(item.meta._items, undefined)) {
        item.items = item.meta._items
        // think._.reverse(item.items)
      }
      Reflect.deleteProperty(item.meta, '_items')

      // console.log(JSON.stringify(item.meta))
      item.url = ''
      // 如果有音频
      if (!Object.is(item.meta._audio_id, undefined)) {
        // 音频播放地址
        item.url = await metaModel.getAttachment('file', item.meta._audio_id)
      }

      const userModel = this.model('users');
      // TODO: 如果有多作者信息
      // if (!Object.is(item.meta._author_id, undefined)) {
        // const authorInfo = await userModel.where({id: item.meta._author_id}).find()
        // const authorInfo = await userModel.getById(item.meta_author_id)
        // userInfo.avatar = await this.model('postmeta').getAttachment('file', userInfo.meta.avatar)
        // item.author = authorInfo
        // 查询 出对应的作者信息
      // } else {
      //   item.author = await userModel.getById(item.author)
      // }
      // 单作者
      item.author = await userModel.getById(item.author)

      // await this.dealLikes(item)
      // console.log(JSON.stringify(this.ctx.state))
      // const userId = this.ctx.state.user.id
      item.like_count = await metaModel.getLikedCount(item.id)

      // 获取当前用户是否喜欢
      // const iLike = await metaModel.getLikeStatus(userId, item.id)
      // item.i_like = iLike.contain > 0
      // item.likes_enabled = true
      // item.sharing_enabled = true

      // _formatOneMeta(item.author)
      // if (item.author.hasOwnProperty('meta')) {
      //   if (item.author.meta.hasOwnProperty('avatar')) {
      //     item.author.avatar = await this.model('postmeta').getAttachment('file', item.author.meta.avatar)
      //   }
      // }
      const repliesCount = await this.model('comments', {appId: this.appId}).where({'comment_post_id': item.id}).count()
      // const user = this.ctx.state.user
      // item.author = user
      // 音频播放的歌词信息
      // lrc
      item.replies_count = repliesCount
      // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
      // if (!Object.is(item.meta['_featured_image']))
      if (!Object.is(item.meta._thumbnail_id, undefined)) {
        // item.thumbnail = {
        //   id: item.meta['_thumbnail_id']
        // }
        // item.thumbnail.url = await metaModel.getAttachment('file', item.meta['_thumbnail_id'])
        item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        // item.thumbnal = await metaModel.getThumbnail({post_id: item.id})
      }
    }
    return list
  }

  async getPodcastList (query, fields) {
    const list = await this.modelInstance.where(query).field(fields.join(",")).order('sort ASC').page(this.get('page'), 10).countSelect()
    // 处理播放列表音频 Meta 信息
    _formatMeta(list.data)
    // 根据 Meta 信息中的音频附件 id 查询出音频地址
    const metaModel = this.model('postmeta', {appId: this.appId})
    for (const item of list.data) {
      item.url = ''
      // 如果有音频
      if (!Object.is(item.meta._audio_id, undefined)) {
        // 音频播放地址
        item.url = await metaModel.getAttachment('file', item.meta._audio_id)
      }
      const userModel = this.model('users');
      // 如果有作者信息
      if (!Object.is(item.meta._author_id, undefined)) {
        const authorInfo = await userModel.where({id: item.meta._author_id}).find()
        // userInfo.avatar = await this.model('postmeta').getAttachment('file', userInfo.meta.avatar)

        // item.author =
        item.authorInfo = authorInfo
        // 查询 出对应的作者信息
      } else {
        item.authorInfo = await userModel.where({id: item.author}).find()
      }
      _formatOneMeta(item.authorInfo)
      if (item.authorInfo.hasOwnProperty('meta')) {
        if (item.authorInfo.meta.hasOwnProperty('avatar')) {
          item.authorInfo.avatar = await this.model('postmeta').getAttachment('file', item.authorInfo.meta.avatar)
        }
      }

      // const user = this.ctx.state.user
      // item.author = user
      // 音频播放的歌词信息
      // lrc

      // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
      // if (!Object.is(item.meta['_featured_image']))
      if (!Object.is(item.meta._thumbnail_id, undefined)) {
        // item.thumbnail = {
        //   id: item.meta['_thumbnail_id']
        // }
        // item.thumbnail.url = await metaModel.getAttachment('file', item.meta['_thumbnail_id'])
        item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        // item.thumbnal = await metaModel.getThumbnail({post_id: item.id})
      }
    }
    // 处理分类及内容层级
    // await this.dealTerms(list)
    // 返回一条数据
    return this.success(list.data)
  }

  /**
   * 获取播客类型的内容
   *
   * @returns {Promise.<void>}
   */
  async getPodcast (query, fields) {
    const list = await this.modelInstance.where(query).field(fields.join(",")).order('sort ASC').page(this.get('page'), 10).countSelect()

    // 处理播放列表音频 Meta 信息
    _formatMeta(list.data)

    // 根据 Meta 信息中的音频附件 id 查询出音频地址
    const metaModel = this.model('postmeta', {appId: this.appId})
    for (const item of list.data) {
      item.url = ''
      // 如果有音频
      if (!Object.is(item.meta._audio_id, undefined)) {
        // 音频播放地址
        item.url = await metaModel.getAttachment('file', item.meta._audio_id)
      }
      const userModel = this.model('users');

      // 如果有作者信息
      if (!Object.is(item.meta._author_id, undefined)) {
        const author = await userModel.where({id: item.meta._author_id}).find()
        _formatOneMeta(author)
        item.authorInfo = author
        // 查询 出对应的作者信息
      } else {
        const author = await userModel.where({id: item.author}).find()
        _formatOneMeta(author)
        item.authorInfo = author

      }
      // 取得头像地址
      if (!Object.is(item.authorInfo.meta.avatar, undefined)) {
        item.authorInfo.avatar = await this.model('postmeta').getAttachment('file', item.authorInfo.meta.avatar)
      }

      // 音频播放的歌词信息
      // lrc

      // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
      // if (!Object.is(item.meta['_featured_image']))
      if (!Object.is(item.meta._thumbnail_id, undefined)) {
        // item.thumbnail = {
        //   id: item.meta['_thumbnail_id']
        // }
        // item.thumbnail.url = await metaModel.getAttachment('file', item.meta['_thumbnail_id'])
        item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        // item.thumbnal = await metaModel.getThumbnail({post_id: item.id})
      }

      // 获取内容的分类信息
      // const terms = await this.model('taxonomy', {appId: this.appId}).getTermsByObject(query.id)
    }
    // 处理分类及内容层级
    await this.dealTerms(list)
    // 返回一条数据
    return this.success(list.data[0])
  }

  /**
   * 搜索主题关键词
   * @returns {Promise<void>}
   */
  async searchAction () {
    const title = this.get('param')
    const postModel = this.model('posts', {appId: this.appId})
    const list = await postModel.findByTitle(title, this.get('page'))
    const metaModel = this.model('postmeta', {appId: this.appId})
    _formatMeta(list.data)

    for (const item of list.data) {
      item.url = ''
      // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
      if (!Object.is(item.meta._thumbnail_id, undefined)) {
        item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
      }
    }
    return this.success(list)
  }

  async newAction () {
    const data = this.post()
    if (think.isEmpty(data.title)) {
      return this.fail('主题为空')
    }
    const slugName = slug(data.title, {tone: false, separateNumbers: false})
    if (think.isEmpty(slugName)) {
      return this.fail('最爱主题创建失败，请检查文字')
    }
    data.name = slugName

    const postModel = this.model('posts', {appId: this.appId})
    const res = await postModel.findByName(slugName)
    if (!think.isEmpty(res)) {
      return this.success(res)
    }
    if (think.isEmpty(data.type)) {
      data.type = 'post_format'
    }
    const currentTime = new Date().getTime();
    data.date = currentTime
    data.modified = currentTime
    if (think.isEmpty(data.author)) {
      data.author = this.ctx.state.user.id
    }
    if (think.isEmpty(data.status)) {
      data.status = 'auto-draft';
    }
    const postId = await this.modelInstance.add(data)
    // 2 更新 meta 数据
    if (!Object.is(data.meta, undefined)) {
      const metaModel = this.model('postmeta', {appId: this.appId})
      // 保存 meta 信息
      await metaModel.save(postId, data.meta)
    }
    // 3 添加内容与 term 分类之间的关联
    // term_taxonomy_id
    const defaultTerm = this.options.default.term
    // console.log(JSON.toString(defaultTerm))
    let categories = []
    if (Object.is(data.categories, undefined) && think.isEmpty(data.categories)) {
     categories = categories.concat(defaultTerm)
    } else {
      // 处理提交过来的分类信息，可能是单分类 id 也可能是数组, 分类 id 为 term_taxonomy_id
      categories = categories.concat(JSON.parse(data.categories))
    }
    // 4 获取内容的格式类别
    if (!Object.is(data.format, undefined) && !think.isEmpty(data.format)) {
      categories = categories.concat(data.format)
    }
    for (const cate of categories) {
      await this.model('taxonomy', {appId: this.appId}).relationships(postId, cate)
    }
    // 5 如果有关联信息，更新关联对象信息
    if (!Object.is(data.relateTo, undefined) && !think.isEmpty(data.relateTo)) {
      const metaModel = this.model('postmeta', {appId: this.appId})
      // 保存关联对象的 meta 信息
      await metaModel.related(data.relateTo, postId, data.relateStatus)
    }
    const newPost = await this.getPost(postId)
    return this.success(newPost)
  }

  async getPost (post_id) {
    let fields = [
      'id',
      'author',
      'status',
      'type',
      'title',
      'name',
      'content',
      'sort',
      'excerpt',
      'date',
      'modified',
      'parent'
    ];
    fields = unique(fields);

    let query = {}
    query.id = post_id
    query = {status: ['NOT IN', 'trash'], id: post_id}

    const list = await this.model('posts', {appId: this.appId}).where(query).field(fields.join(",")).order('sort ASC').page(this.get('page'), 10).countSelect()

    // 处理播放列表音频 Meta 信息
    _formatMeta(list.data)

    // 根据 Meta 信息中的音频附件 id 查询出音频地址
    const metaModel = this.model('postmeta', {appId: this.appId})
    for (const item of list.data) {
      item.url = ''
      // 如果有音频
      if (!Object.is(item.meta._audio_id, undefined)) {
        // 音频播放地址
        item.url = await metaModel.getAttachment('file', item.meta._audio_id)
      }
      const userModel = this.model('users');

      // 如果有作者信息
      if (!Object.is(item.meta._author_id, undefined)) {
        const author = await userModel.where({id: item.meta._author_id}).find()
        _formatOneMeta(author)
        item.authorInfo = author
        // 查询 出对应的作者信息
      } else {
        const author = await userModel.where({id: item.author}).find()
        _formatOneMeta(author)
        item.authorInfo = author

      }
      // 取得头像地址
      if (!Object.is(item.authorInfo.meta.avatar, undefined)) {
        item.authorInfo.avatar = await this.model('postmeta').getAttachment('file', item.authorInfo.meta.avatar)
      }

      // 音频播放的歌词信息
      // lrc

      // 如果有封面 默认是 thumbnail 缩略图，如果是 podcast 就是封面特色图片 featured_image
      // if (!Object.is(item.meta['_featured_image']))
      if (!Object.is(item.meta._thumbnail_id, undefined)) {
        // item.thumbnail = {
        //   id: item.meta['_thumbnail_id']
        // }
        // item.thumbnail.url = await metaModel.getAttachment('file', item.meta['_thumbnail_id'])
        item.featured_image = await metaModel.getAttachment('file', item.meta._thumbnail_id)
        // item.thumbnal = await metaModel.getThumbnail({post_id: item.id})
      }

      // 获取内容的分类信息
      // const terms = await this.model('taxonomy', {appId: this.appId}).getTermsByObject(query.id)
      // console.log(JSON.stringify(terms))
    }
    // 处理分类及内容层级
    await this.dealTerms(list)
    // 处理标签信息
    await this.dealTags(list)

    await this.dealLikes(list.data[0])

    return list.data[0]
  }

  /**
   * 处理分类信息，为查询的结果添加分类信息
   * @param list
   * @returns {Promise.<*>}
   */
  async dealTerms (list) {
    const _taxonomy = this.model('taxonomy', {appId: this.appId})
    for (const item of list.data) {
      item.categories = await _taxonomy.findCategoriesByObject(item.id)
    }
    // 处理内容层级
    // let treeList = await arr_to_tree(list.data, 0);
    list.data = await arr_to_tree(list.data, 0);

    return list
  }

  /**
   * 处理内容标签信息
   * @param list
   * @returns {Promise.<void>}
   */
  async dealTags (list) {
    const _taxonomy = this.model('taxonomy', {appId: this.appId})
    for (const item of list.data) {
      item.tags = await _taxonomy.findTagsByObject(item.id)
    }
  }

  // async
  /**
   * 处理内容喜欢的信息
   * @param post
   * @returns {Promise.<void>}
   */
  async dealLikes (post) {
    const userId = this.ctx.state.user.id
    const postMeta = this.model('postmeta', {appId: this.appId})

    const result = await postMeta.where({
      post_id: post.id,
      meta_key: '_liked'
    }).find()
    // 当前登录用户是否喜欢
    let iLike = false
    let likes = []
    const userModel = this.model('users')
    let totalCount = 0

    if (!think.isEmpty(result)) {
      if (!think.isEmpty(result.meta_value)) {
        const exists = await think._.find(JSON.parse(result.meta_value), ['id', userId])
        if (exists) {
          iLike = true
        }
        const list = JSON.parse(result.meta_value)
        totalCount = list.length
        for (const u of list) {
          const user = await userModel.where({id: u.id}).find()
          _formatOneMeta(user)
          likes.push(user)
        }
      }
    }
    // console.log(JSON.toString(likes))

    post.like_count = totalCount
    post.i_like = iLike
    post.likes = likes
  }

}