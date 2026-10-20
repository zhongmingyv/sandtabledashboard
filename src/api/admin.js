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
  // 换随机密码、踢会话、发到注册邮箱；信没发出去时响应里带 password 让管理员手动转达
  resetPassword: (id) => http.post(`/admin/users/${id}/reset-password`),
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
  // 网页版：浏览器里玩这条战役要不要先登录（过审的战役都会出现在官网「在线游戏」页）
  setCampaignWebLoginRequired: (id, loginRequired) =>
    http.put(`/admin/campaigns/${id}/web-login-required`, { loginRequired }),

  // 房间（没结束的对局桌）
  matches: (params) => http.get('/admin/matches', params),
  releaseMatch: (id) => http.post(`/admin/matches/${id}/release`),

  // 创意工坊条目名单（ADR-0010 §11）。键是 Steam 条目 id，不是本服的 Campaign 行——
  // 绕开游戏订阅的条目本服可能根本没有对应行。封禁走 /admin 那条（AdminSession 鉴权），
  // 列表与解封是后台独有的路由。
  workshopBans: () => http.get('/workshop/bans'),
  banWorkshopItem: (itemId, reason) => http.post('/admin/workshop/bans', { itemId, reason }),
  unbanWorkshopItem: (itemId) => http.del(`/workshop/bans/${itemId}`),

  // 擂台：所有擂台（含擂主被封的）；下架 = 撤擂，连战绩删
  arenas: (params) => http.get('/admin/arenas', params),
  deleteArena: (id) => http.del(`/admin/arenas/${id}`),
  // 素材管理：作者发布战役时传上来的素材（R2 按内容哈希一份），取代老图床管理
  campaignAssets: (params) => http.get('/admin/campaign-assets', params),
  campaignAsset: (sha) => http.get(`/admin/campaign-assets/${sha}`),
  unbanCampaignAsset: (sha) => http.post(`/admin/campaign-assets/${sha}/unban`),
  // 从资源库下架：只撤分享、不碰文件
  unlistCampaignAsset: (sha, reason = '') => http.post(`/admin/campaign-assets/${sha}/unlist`, { reason }),
  // action：unlist（下架）| ban（封禁，留墓碑拦再传）| delete（删除，不留墓碑）
  batchCampaignAssets: (shas, action, reason = '') => http.post('/admin/campaign-assets/batch', { shas, action, reason }),
  // 代作者分享进资源库（当场上架）：ownerPlayerId 取详情里 shareCandidates 的一个；name 空 = 作者工程里的文件名
  shareCampaignAsset: (sha, ownerPlayerId, name = '') => http.post(`/admin/campaign-assets/${sha}/share`, { ownerPlayerId, name }),

  // 配置
  settings: () => http.get('/admin/settings'),
  saveSettings: (items) => http.put('/admin/settings', { items }),
  runBlobGc: () => http.post('/admin/blob-gc/run'),

  // 审计
  audit: (params) => http.get('/admin/audit', params),
  loginLogs: (params) => http.get('/admin/login-logs', params),

  // 游戏版本（导出独立版的整包，玩家端启动查新 / 下载）
  gameReleases: () => http.get('/admin/game-releases'),
  // 每版整包同步出来的 data.zip（战役包），按游戏、版本列
  gameData: () => http.get('/admin/game-data'),
  deleteGameRelease: (gameId, version) => http.del(`/admin/game-releases/${gameId}/${version}`),
  // 拿这个游戏当前那一版整包补建「战役管理」那一条（整包登记早于战役同步的老版本才需要）。
  // 官方整包一律 Maker 不可见，拆出的战役包只给 GM 审举报用（ADR-0014 §7，2026-10-05 修订）
  // 后台任务：立刻回 { status: 'processing', jobId }，做完才有 { campaignId, created }
  publishGameCampaign: async (gameId, onStage) => {
    const res = await http.post(`/admin/game-releases/${gameId}/campaign`)
    return res?.jobId ? waitJob(res, res.jobId, onStage) : res
  },
  uploadGamePackage,
  uploadGameDirect,
  // 最低版本（强制升级线）：低于它的游戏一打开就要求更新；0 = 取消强制。不许高于当前最新版
  setGameMinVersion: (gameId, version) => http.put(`/admin/game-releases/${gameId}/min-version`, { version }),

  // 网页版模板：Maker 发版打的 web-template.zip（引擎 + 预编译代码），所有战役共用。
  // 换下来的上一版留着可回滚（activateWebTemplate），更早的 keepDays 天后服务器自己删。
  // 游戏数据不在这里：网页版开局按战役编号去下 Maker「上传战役」传上来、审核通过的那一版
  webTemplate: () => http.get('/admin/web-template'),
  uploadWebTemplate,
  uploadWebTemplateDirect,
  activateWebTemplate: (dir) => http.post(`/admin/web-template/${dir}/activate`),

  // 官方发版的 exe：Maker 版本（root = /admin/maker-releases）与用户版服务器（/admin/lan-server-releases），
  // 客户端启动查新 / 强制升级。两页同一套接口，只换 root
  exeReleases: (root) => http.get(root),
  withdrawExeRelease: (root, version) => http.del(`${root}/${version}`),
  // 传上来的先「待生效」，点这个才成为最新版；forced = 顺手把最低版本设成这一版（强制升级）
  activateExeRelease: (root, version, forced) => http.post(`${root}/${version}/activate`, undefined, { forced }),
  uploadExe,
  uploadExeDirect,

  // 临时文件：随手发给别人的文件，不进任何版本流程、不影响客户端查新。
  // 每个文件一条不用登录的链接 link（/d/{id}，相对服务器地址）；expiresAt 空 = 永久，到点链接失效、文件随后由服务器删掉
  tempFiles: () => http.get('/admin/temp-files'),
  updateTempFile: (id, note, expiresAt) => http.put(`/admin/temp-files/${id}`, { note, expiresAt }),
  deleteTempFile: (id) => http.del(`/admin/temp-files/${id}`),
  uploadTempFile,

  // Steam 应用：这台服务器认哪几个 Steam 应用（Maker 本体 + 官方游戏），各用哪把发行商密钥验票、要不要先买。
  // 密钥只写不读：列表只给末 4 位；保存时 webApiKey 留空 = 保留原来那把。
  steamApps: () => http.get('/admin/steam-apps'),
  saveSteamApp: (appId, body) => http.put(`/admin/steam-apps/${appId}`, body),
  deleteSteamApp: (appId) => http.del(`/admin/steam-apps/${appId}`),

  // 激活码订单：echoshorts.win 卖出的 Maker 激活码，激活码 worker 发完码推过来（POST /payments/notify）。
  // activatedBy = 这枚码激活到了哪个账号（还没激活为 null）。
  licenseOrders: (params) => http.get('/admin/license-orders', params),

  // 战役审核（ADR-0014 §9）：按版本审。放行 / 驳回针对战役当前那一版待审版
  reviewRevisions: (params) => http.get('/admin/review/revisions', params),
  reviewRevision: (id) => http.get(`/admin/review/revisions/${id}`),
  // shareIds：详情里勾上的资源库分享，随战役一起放行
  approveCampaign: (id, shareIds = []) => http.post(`/admin/review/campaigns/${id}/approve`, { shareIds }),
  rejectCampaign: (id, reason, block = false) => http.post(`/admin/review/campaigns/${id}/reject`, { reason, block }),
  banCampaignAsset: (sha) => http.post(`/admin/campaign-assets/${sha}/ban`),

  // 资源库审核（ADR-0016）：作者发布战役时勾选分享的素材，每条分享各审各的；封禁素材走上面的 banCampaignAsset
  library: (params) => http.get('/admin/library', params),
  approveLibrary: (id) => http.post(`/admin/library/${id}/approve`),
  rejectLibrary: (id, reason) => http.post(`/admin/library/${id}/reject`, { reason }),
  // action：approve | reject | ban（ban 按文件封，同 banCampaignAsset）
  batchLibrary: (ids, action, reason = '') => http.post('/admin/library/batch', { ids, action, reason }),
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
 * 分片上传一个游戏整包并登记。官方站在 Cloudflare 后面，单个请求体超过 100MB 会被边缘直接 413，
 * 而一个导出游戏光 exe 就一百多 MB，所以按服务器给的片大小（16MB）逐片 PUT。
 * 某一片撞上 409（服务器已收字节数与本地不一致，比如上一片其实已经落盘、只是应答丢了），
 * 按服务器报的字节数续传，不从头来。
 * onProgress(已发字节, 总字节)。版本号不用填：服务器从包里的 data/server.json 读。
 * 官方整包与 Maker 彻底分开：Maker 看不到这个游戏；服务器照样把 data/ 拆成战役包 + 素材传上去，只给 GM 审举报用。
 *
 * 传完之后服务器在后台登记（解包、打战役包、把整包传上 R2，要几十秒到几分钟）：complete 立刻回
 * { status: 'processing', stage }，这里每 2 秒问一次进度，onStage(阶段说明) 给界面显示，做完返回登记结果。
 * 不能让 complete 请求一直挂着等：前端 15 秒超时、Cloudflare 代理 100 秒超时都会先断。
 */
async function uploadGamePackage(file, onProgress, onStage) {
  const prefix = '/admin/game-releases/uploads'
  const uploadId = await uploadChunks(prefix, file, onProgress)
  const res = await http.post(`${prefix}/${uploadId}/complete`)
  return waitJob(res, uploadId, onStage, prefix)
}

/**
 * 直传游戏整包（导出时打的 zip）：浏览器算好 SHA-256，整包分片直接传给 R2（不经服务器）；服务器按范围读包里的目录与 data/
 * （同步战役要），exe 不下回去，整包在存储里复制到正式位置。
 * onStage(说明)：算校验值 / 服务器处理各阶段；传的过程中给空串（界面显示进度条）。
 */
async function uploadGameDirect(file, onProgress, onStage) {
  onStage?.('正在计算校验值')
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  onStage?.('')
  const { uploadId, parts } = await directUpload([file], onProgress)
  const res = await http.post(`/admin/game-releases/direct/${uploadId}/complete`, { parts, sha256 })
  return waitJob(res, uploadId, serverStage(onStage), '/admin/game-releases/uploads')
}

/** 分片上传网页版模板并登记（一百多 MB，服务器在后台拆成一个个文件传进存储）。 */
async function uploadWebTemplate(file, onProgress, onStage) {
  const prefix = '/admin/web-template/uploads'
  const uploadId = await uploadChunks(prefix, file, onProgress)
  const res = await http.post(`${prefix}/${uploadId}/complete`)
  return waitJob(res, uploadId, onStage, prefix)
}

/**
 * 经服务器中转分片上传官方发版的 exe 或装着它的 zip（Maker / 用户版服务器）并登记成待生效（同上，几十到几百 MB，慢）。
 * exe 走 uploadExeDirect 直传 R2；zip 要服务器解开，只能走这里。版本号不用填：服务器从 exe 的文件版本读。
 */
async function uploadExe(root, file, onProgress, onStage) {
  const prefix = `${root}/uploads`
  const uploadId = await uploadChunks(prefix, file, onProgress)
  const res = await http.post(`${prefix}/${uploadId}/complete`)
  return waitJob(res, uploadId, serverStage(onStage), prefix)
}

/**
 * 直传 exe（Maker / 用户版服务器）：浏览器算好 SHA-256，整个文件分片直接传给 R2（不经服务器），服务器只认版本号、登记成待生效。
 * onStage(说明)：算校验值 / 服务器处理各阶段；传的过程中给空串（界面显示进度条）。
 */
async function uploadExeDirect(root, file, onProgress, onStage) {
  onStage?.('正在计算校验值（几百 MB 要几秒）')
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  onStage?.('')
  const { uploadId, parts } = await directUpload([file], onProgress)
  const res = await http.post(`${root}/direct/${uploadId}/complete`, { parts, sha256 })
  return waitJob(res, uploadId, serverStage(onStage), `${root}/uploads`)
}

/** 直传临时文件：浏览器分片直接传给 R2（不经服务器），服务器挪到正式位置、记一行。返回 { status, file }。 */
async function uploadTempFile(file, note, expiresAt, onProgress, onStage) {
  const { uploadId, parts } = await directUpload([file], onProgress)
  const res = await http.post(`/admin/temp-files/direct/${uploadId}/complete`, { parts, note, expiresAt })
  return waitJob(res, uploadId, serverStage(onStage), '/admin/temp-files/uploads')
}

/** 直传网页版模板：打包出来的 web-template 文件夹里的一个个文件分片直接传给 R2，服务器查文件名、登记成待生效。 */
async function uploadWebTemplateDirect(files, onProgress, onStage) {
  const { uploadId, parts } = await directUpload(files, onProgress)
  const res = await http.post(`/admin/web-template/direct/${uploadId}/complete`, { parts })
  return waitJob(res, uploadId, serverStage(onStage), '/admin/web-template/uploads')
}

/** 服务器登记阶段的说明前面加「服务器正在处理」，与传之前的「计算校验值」区分开。 */
function serverStage(onStage) {
  return (s) => onStage?.(`已传完，服务器正在处理：${s || '排队中'}`)
}

/** 同时传几片：浏览器对同一个域名本来也只开六条连接，再多没用。 */
const DIRECT_PARALLEL = 4

/**
 * 后台大文件直传（服务器 Admin/DirectUpload）：服务器给每个文件每一片签好 R2 的上传地址，这里几片一起 PUT 过去、
 * 收齐每一片应答头里的 ETag 交回给各页的「完成」端点。一片失败重试两次，还不行整趟作废（告诉服务器丢掉已传的片）。
 * R2 桶的跨站规则要放行后台域名的 PUT、并露出 ETag，否则一片都传不成（服务器 --check-r2 会查）。
 */
async function directUpload(files, onProgress) {
  const start = await http.post('/admin/direct-uploads', { files: files.map((f) => ({ name: f.name, size: f.size })) })
  const { uploadId, partBytes } = start
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const loaded = new Map()
  const report = () => onProgress?.([...loaded.values()].reduce((a, b) => a + b, 0), total)
  const jobs = start.files.flatMap((f, fi) => f.urls.map((url, i) => ({ fi, partNumber: i + 1, url })))
  const parts = start.files.map(() => [])
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++]
      const from = (job.partNumber - 1) * partBytes
      const blob = files[job.fi].slice(from, from + partBytes)
      const id = `${job.fi}:${job.partNumber}`
      const eTag = await putPart(job.url, blob, (n) => {
        loaded.set(id, n)
        report()
      })
      parts[job.fi][job.partNumber - 1] = { partNumber: job.partNumber, eTag }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(DIRECT_PARALLEL, jobs.length) }, worker))
  } catch (err) {
    http.del(`/admin/direct-uploads/${uploadId}`).catch(() => {})
    throw err
  }
  return { uploadId, parts }
}

/** PUT 一片，回它的 ETag。XHR 而不是 fetch：要上传进度。失败重试两次。 */
async function putPart(url, blob, onLoaded, attempt = 1) {
  if (url.startsWith('mock:')) {
    onLoaded(blob.size)
    return '"mock"'
  }
  try {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.upload.onprogress = (e) => onLoaded(e.loaded)
      xhr.onload = () => {
        const eTag = xhr.getResponseHeader('ETag')
        if (xhr.status >= 200 && xhr.status < 300 && eTag) resolve(eTag)
        else if (xhr.status >= 200 && xhr.status < 300)
          reject(new Error('传上去了但拿不到 ETag：R2 桶的跨站规则没把 ETag 露出来（服务器上跑 --check-r2 看怎么改）'))
        else reject(new Error(`R2 拒收这一片：HTTP ${xhr.status}`))
      }
      xhr.onerror = () =>
        reject(new Error('传不到 R2：网络断了，或 R2 桶的跨站规则没放行后台域名的 PUT（服务器上跑 --check-r2 看怎么改）'))
      xhr.send(blob)
    })
  } catch (err) {
    if (attempt >= 3) throw err
    onLoaded(0)
    return putPart(url, blob, onLoaded, attempt + 1)
  }
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
