import { http } from './http'

export const api = {
  // 鉴权
  login: (username, password) => http.post('/admin/login', { username, password }),
  logout: () => http.post('/admin/logout'),
  changePassword: (oldPassword, newPassword) =>
    http.post('/admin/change-password', { oldPassword, newPassword }),

  // 概览
  overview: () => http.get('/admin/overview'),

  // 用户
  users: (params) => http.get('/admin/users', params),
  banUser: (id) => http.post(`/admin/users/${id}/ban`),
  unbanUser: (id) => http.post(`/admin/users/${id}/unban`),
  setBlobQuota: (id, bytes) => http.put(`/admin/users/${id}/blob-quota`, { bytes }),
  setCampaignQuota: (id, count) => http.put(`/admin/users/${id}/campaign-quota`, { count }),
  setReviewer: (id, isReviewer) => http.put(`/admin/users/${id}/reviewer`, { isReviewer }),
  // GM:Maker 联网模式里出现 GM 页签,下载被举报的对局、本机播一遍、提交结论
  setGm: (id, isGm) => http.put(`/admin/users/${id}/gm`, { isGm }),
  setFeaturedMaker: (id, isFeaturedMaker) =>
    http.put(`/admin/users/${id}/featured-maker`, { isFeaturedMaker }),

  // 战役
  campaigns: (params) => http.get('/admin/campaigns', params),
  campaign: (id) => http.get(`/admin/campaigns/${id}`),
  banCampaign: (id) => http.post(`/admin/campaigns/${id}/ban`),
  unbanCampaign: (id) => http.post(`/admin/campaigns/${id}/unban`),
  deleteCampaign: (id) => http.del(`/admin/campaigns/${id}`),
  setCampaignFeatured: (id, isFeatured) =>
    http.put(`/admin/campaigns/${id}/featured`, { isFeatured }),
  setCampaignPinned: (id, isPinned) => http.put(`/admin/campaigns/${id}/pinned`, { isPinned }),

  // 房间（没结束的对局桌）
  matches: (params) => http.get('/admin/matches', params),
  releaseMatch: (id) => http.post(`/admin/matches/${id}/release`),

  // 创意工坊条目名单（ADR-0010 §11）。键是 Steam 条目 id，不是本服的 Campaign 行——
  // 绕开游戏订阅的条目本服可能根本没有对应行。封禁走 /admin 那条（AdminSession 鉴权），
  // 列表与解封是后台独有的路由。
  workshopBans: () => http.get('/workshop/bans'),
  banWorkshopItem: (itemId, reason) => http.post('/admin/workshop/bans', { itemId, reason }),
  unbanWorkshopItem: (itemId) => http.del(`/workshop/bans/${itemId}`),

  // 图床（内容寻址 blob store）
  listBlobs: (params) => http.get('/admin/blobs', params),
  banBlob: (sha) => http.post(`/admin/blobs/${sha}/ban`),
  unbanBlob: (sha) => http.post(`/admin/blobs/${sha}/unban`),
  deleteBlob: (sha) => http.del(`/admin/blobs/${sha}`),

  // 配置
  settings: () => http.get('/admin/settings'),
  saveSettings: (items) => http.put('/admin/settings', { items }),
  runBlobGc: () => http.post('/admin/blob-gc/run'),

  // 审计
  audit: (params) => http.get('/admin/audit', params),
  loginLogs: (params) => http.get('/admin/login-logs', params),

  // 游戏版本（导出独立版的整包，玩家端启动查新 / 下载）
  gameReleases: () => http.get('/admin/game-releases'),
  deleteGameRelease: (gameId, version) => http.del(`/admin/game-releases/${gameId}/${version}`),
  // 拿这个游戏当前那一版整包补建「战役管理」那一条（整包登记早于战役同步的老版本才需要）。
  // makerVisible 必填（ADR-0014 §7）：true = Maker 也能联机；false = 只给导出的游戏
  publishGameCampaign: (gameId, makerVisible) =>
    http.post(`/admin/game-releases/${gameId}/campaign`, undefined, { makerVisible }),
  uploadGamePackage,
  setMakerVisible,

  // Maker 版本（编辑器自己的安装包，Maker 启动查新 / 强制升级）
  makerReleases: () => http.get('/admin/maker-releases'),
  withdrawMakerRelease: (version) => http.del(`/admin/maker-releases/${version}`),
  uploadMakerExe,

  // 战役审核（ADR-0014 §9）：按版本审。放行 / 驳回针对战役当前那一版待审版
  reviewRevisions: (params) => http.get('/admin/review/revisions', params),
  reviewRevision: (id) => http.get(`/admin/review/revisions/${id}`),
  approveCampaign: (id) => http.post(`/admin/review/campaigns/${id}/approve`),
  rejectCampaign: (id, reason, block = false) => http.post(`/admin/review/campaigns/${id}/reject`, { reason, block }),
  banCampaignAsset: (sha) => http.post(`/admin/campaign-assets/${sha}/ban`),
}

/** 等后台任务做完：每 2 秒问一次，onStage(阶段说明) 给界面显示，做完返回结果。 */
async function waitJob(first, jobId, onStage, prefix = '/admin/game-releases/uploads') {
  let res = first
  while (res?.status === 'processing') {
    onStage?.(res.stage)
    await new Promise((r) => setTimeout(r, 2000))
    res = await http.get(`${prefix}/${jobId}`)
  }
  return res
}

/**
 * 事后改「Maker 也能联机」。关：立刻完成。开：服务器要拿最新整包拆出战役包与素材再传，在后台做，这里轮询到做完。
 */
async function setMakerVisible(gameId, makerVisible, onStage) {
  const res = await http.put(`/admin/game-releases/${gameId}/maker-visible`, { makerVisible })
  return res?.status === 'processing' ? waitJob(res, res.jobId, onStage) : res
}

/**
 * 分片上传一个游戏整包并登记。官方站在 Cloudflare 后面，单个请求体超过 100MB 会被边缘直接 413，
 * 而一个导出游戏光 exe 就一百多 MB，所以按服务器给的片大小（16MB）逐片 PUT。
 * 某一片撞上 409（服务器已收字节数与本地不一致，比如上一片其实已经落盘、只是应答丢了），
 * 按服务器报的字节数续传，不从头来。
 * onProgress(已发字节, 总字节)。版本号不用填：服务器从包里的 data/server.json 读。
 * makerVisible：是 = Maker 玩家也能开桌加入（服务器把 data/ 拆成战役包 + 素材传上去）；否 = 只有导出的游戏能联机。
 *
 * 传完之后服务器在后台登记（解包、打战役包、把整包传上 R2，要几十秒到几分钟）：complete 立刻回
 * { status: 'processing', stage }，这里每 2 秒问一次进度，onStage(阶段说明) 给界面显示，做完返回登记结果。
 * 不能让 complete 请求一直挂着等：前端 15 秒超时、Cloudflare 代理 100 秒超时都会先断。
 */
async function uploadGamePackage(file, makerVisible, onProgress, onStage) {
  const prefix = '/admin/game-releases/uploads'
  const uploadId = await uploadChunks(prefix, file, onProgress)
  // makerVisible：「Maker 也能联机」，服务器要求每次明说（ADR-0014 §7）
  const res = await http.post(`${prefix}/${uploadId}/complete`, undefined, { makerVisible })
  return waitJob(res, uploadId, onStage, prefix)
}

/**
 * 分片上传 Maker 的 exe 并登记（同上，几百 MB）。版本号不用填：服务器从 exe 的文件版本读。
 * forced：登记成功后把「Maker 最低版本」设成这一版，低于它的 Maker 一打开就得先更新。
 */
async function uploadMakerExe(file, forced, onProgress, onStage) {
  const prefix = '/admin/maker-releases/uploads'
  const uploadId = await uploadChunks(prefix, file, onProgress)
  const res = await http.post(`${prefix}/${uploadId}/complete`, undefined, { forced })
  return waitJob(res, uploadId, onStage, prefix)
}

/** 开一个分片上传、逐片 PUT 完，返回上传 id。 */
async function uploadChunks(prefix, file, onProgress) {
  const { uploadId, chunkBytes } = await http.post(prefix)
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + chunkBytes, file.size)
    try {
      const res = await http.putBinary(
        `${prefix}/${uploadId}`,
        file.slice(offset, end),
        { offset },
        (loaded) => onProgress?.(offset + loaded, file.size),
      )
      offset = res.received
    } catch (err) {
      const received = err?.response?.status === 409 ? err.response.data?.received : undefined
      if (typeof received !== 'number') throw err
      offset = received
    }
    onProgress?.(offset, file.size)
  }
  return uploadId
}
