// 内置 mock：后端 /admin/* 未实现时让前端独立跑通。数据在内存，刷新即重置。
// 契约与 docs/admin-backend-spec.md §11 对齐。切到真后端只需 .env 置 VITE_USE_MOCK=false。

const now = Date.now()
const iso = (msAgo) => new Date(now - msAgo).toISOString()

function rand(seed) {
  // 稳定伪随机，保证每次刷新数据一致
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const names = ['赵云', '关羽', '张飞', '诸葛亮', '曹操', '孙权', '周瑜', '吕布', '貂蝉', '司马懿', 'zhongmingyu', '玩家小明']

const users = Array.from({ length: 42 }, (_, i) => ({
  playerId: 'u' + String(i + 1).padStart(4, '0'),
  email: `user${i + 1}@example.com`,
  displayName: names[i % names.length] + (i >= names.length ? i : ''),
  createdAt: iso((42 - i) * 86400000 + rand(i) * 1e7),
  campaignQuota: i % 4 === 0 ? 5 : 0,
  isBanned: i % 11 === 3,
  isReviewer: i % 17 === 1,
  isFeaturedMaker: i % 7 === 2,
  campaignCount: Math.floor(rand(i + 2) * 4),
  sharedAssetCount: Math.floor(rand(i + 3) * 10),
}))

const eras = ['三国', '战国', '楚汉', '春秋', '']
const campaigns = Array.from({ length: 30 }, (_, i) => {
  const owner = users[i % users.length]
  return {
    id: 'c' + String(i + 1).padStart(4, '0'),
    ownerPlayerId: owner.playerId,
    ownerName: owner.displayName,
    title: `战役·${eras[i % eras.length] || '无题'}${i + 1}`,
    era: eras[i % eras.length],
    createdAt: iso((30 - i) * 86400000),
    downloadCount: Math.floor(rand(i + 5) * 200),
    isDeleted: i % 9 === 4,
    isBanned: i % 13 === 7,
    approvalStatus: ['approved', 'pending', 'approved', 'rejected'][i % 4],
    rejectReason: i % 4 === 3 ? '与史实出入过大' : '',
    isFeatured: i % 6 === 1,
    isPinned: i % 14 === 5,
    // 非空 = 工坊索引行（字节在 Steam，本服只留元数据），此时 sizeBytes 恒 0
    workshopItemId: i % 3 === 1 ? String(3100000000 + i) : '',
    sizeBytes: i % 3 === 1 ? 0 : Math.floor((1 + rand(i + 7) * 24) * 1024 * 1024),
    // >0 = 「游戏版本」上传同步来的战役，当前第几版
    gameVersion: i % 3 === 2 ? 1 + (i % 4) : 0,
  }
})

const workshopBans = [
  { itemId: '3100000004', reason: '搬运他人作品', bannedBy: 'reviewer:u0003', bannedAt: iso(3 * 86400000) },
  { itemId: '3100000019', reason: '含违规文本', bannedBy: 'zhongmingyu', bannedAt: iso(86400000) },
]

// 游戏版本：导出独立版的整包。mock 下没有真包可读，上传完成时按「该游戏最新版 + 1」伪造一条。
const gameReleases = [
  { gameId: 'camp_' + 'a'.repeat(32), version: 2, title: '赤壁', size: 142 * 1024 * 1024, sha256: 'b'.repeat(64), createdAt: iso(2 * 86400000), downloadCount: 37, archived: false },
  { gameId: 'camp_' + 'a'.repeat(32), version: 1, title: '赤壁', size: 140 * 1024 * 1024, sha256: 'c'.repeat(64), createdAt: iso(9 * 86400000), downloadCount: 112, archived: true },
]
const gameUploads = {}
// 各游戏的最低版本（强制升级线）
const gameMinVersions = {}

// 登记一版游戏整包（分片上传与直传共用）：成为最新版、旧版清掉只留记录、同步战役管理那一行
function registerGameMock(size) {
  const latest = gameReleases[0]
  const row = { ...latest, version: latest.version + 1, size, sha256: 'd'.repeat(64), createdAt: iso(0), downloadCount: 0, archived: false }
  gameReleases.forEach((r) => { if (r.gameId === row.gameId) r.archived = true })
  gameReleases.unshift(row)
  let camp = campaigns.find((c) => c.gameId === row.gameId)
  const campaignCreated = !camp
  if (!camp) {
    camp = {
      ...campaigns[2], id: 'c' + String(campaigns.length + 1).padStart(4, '0'), gameId: row.gameId,
      title: row.title, ownerName: '官方发布', workshopItemId: '', downloadCount: 0,
      isDeleted: false, isBanned: false, approvalStatus: 'approved', createdAt: iso(0),
    }
    campaigns.unshift(camp)
  }
  camp.gameVersion = row.version
  return ok({ status: 'done', ...row, campaignId: camp.id, campaignCreated })
}

// 网页版模板：所有战役共用一份。mock 下没有真包可读，上传完成时换一个标识
const webFiles = ['index.html', 'index.js', 'index.wasm', 'index.pck', 'index.png', 'index.icon.png']
// 留着的模板：正在用的 + 上一版（不删）+ 待删除（expiresAt）
let webTemplates = [
  { dir: '3fa9c2d1', size: 147 * 1024 * 1024, fileCount: 6, files: webFiles, createdAt: iso(86400000),
    isCurrent: true, retiredAt: null, expiresAt: null },
  { dir: '8b02e7aa', size: 146 * 1024 * 1024, fileCount: 6, files: webFiles, createdAt: iso(5 * 86400000),
    isCurrent: false, retiredAt: iso(86400000), expiresAt: null },
  { dir: '5c11d0f4', size: 145 * 1024 * 1024, fileCount: 6, files: webFiles, createdAt: iso(9 * 86400000),
    isCurrent: false, retiredAt: iso(5 * 86400000), expiresAt: iso(-2 * 86400000) },
]
function webTemplateState() {
  return { chunkBytes: 16 * 1024 * 1024, keepDays: 7, current: webTemplates.find((t) => t.isCurrent) || null, versions: webTemplates }
}
// 同服务器 WebTemplateStore.Activate：正在用的退成上一版，原来的上一版进 7 天倒计时
function activateWebTemplate(dir) {
  const target = webTemplates.find((t) => t.dir === dir)
  if (!target) return false
  if (target.isCurrent) return true
  for (const t of webTemplates) {
    if (!t.isCurrent && !t.expiresAt && t !== target) t.expiresAt = iso(-7 * 86400000)
  }
  for (const t of webTemplates) if (t.isCurrent) Object.assign(t, { isCurrent: false, retiredAt: iso(0) })
  Object.assign(target, { isCurrent: true, pending: false, retiredAt: null, expiresAt: null })
  webTemplates = [target, ...webTemplates.filter((t) => t !== target).sort((a, b) => (b.retiredAt > a.retiredAt ? 1 : -1))]
  return true
}
const webUploads = {}
const directUploads = {}

// 房间：没结束的对局桌。形状 = 玩家端对局详情 + lastOpAt / onlinePlayerIds
const matches = Array.from({ length: 6 }, (_, i) => {
  const camp = campaigns[i % campaigns.length]
  const a = users[i], b = users[i + 7]
  const playing = i % 3 !== 0
  return {
    matchId: 'm' + String(i + 1).padStart(4, '0'),
    campaignId: camp.id,
    campaignTitle: camp.title,
    workshopItemId: camp.workshopItemId,
    state: playing ? 'Playing' : 'Waiting',
    createdAt: now - (i + 1) * 5400000,
    lastOpAt: now - i * 600000,
    hostSeatIndex: 0,
    seats: [
      { seatIndex: 0, playerId: a.playerId, playerName: a.displayName, factionId: 'F_Wei', factionName: '魏', hasLeft: false },
      ...(playing ? [{ seatIndex: 1, playerId: b.playerId, playerName: b.displayName, factionId: 'F_Shu', factionName: '蜀', hasLeft: i === 4 }] : []),
    ],
    vacantFactions: playing ? (i === 4 ? ['F_Shu'] : []) : ['F_Shu'],
    aiFactions: [],
    onlinePlayerIds: i % 2 === 0 ? [a.playerId] : [a.playerId, b.playerId],
  }
})

const layers = ['background', 'height', 'terrain', 'edge', 'road', 'object', 'ui']
// 资源库（ADR-0016）：发布战役时勾选分享的素材，每条分享一行
const libraryKinds = ['image', 'image', 'sound', 'music', 'video']
const library = Array.from({ length: 36 }, (_, i) => {
  const owner = users[(i + 3) % users.length]
  const kind = libraryKinds[i % libraryKinds.length]
  return {
    id: 's' + String(i + 1).padStart(4, '0'),
    sha256: String(i).padStart(64, 'a'),
    name: `素材${i + 1}.${kind === 'image' ? 'png' : kind === 'video' ? 'ogv' : 'ogg'}`,
    kind,
    ext: kind === 'image' ? '.png' : kind === 'video' ? '.ogv' : '.ogg',
    size: Math.floor((0.05 + rand(i + 9) * 4) * 1024 * 1024),
    width: kind === 'image' ? 64 : 0,
    height: kind === 'image' ? 64 : 0,
    usages: kind === 'image' ? [{ layer: layers[i % layers.length], mode: i % 3 === 0 ? 'random' : '', ui: '' }] : [{ layer: 'effect', mode: '', ui: '' }],
    hasGrid: i % 4 === 0,
    ownerPlayerId: owner.playerId,
    ownerName: owner.displayName,
    createdAt: iso((36 - i) * 43200000),
    downloadCount: Math.floor(rand(i + 8) * 200),
    status: ['pending', 'approved', 'rejected'][i % 3],
    rejectReason: i % 3 === 2 ? '画面不合适' : '',
    sameShaApproved: i % 6 === 0,
    url: '',
    thumbUrl: '',
  }
})

// 擂台：擂主给每个阵营定谁来下
const arenaFactions = '[{"factionId":"A","name":"秦"},{"factionId":"B","name":"楚"},{"factionId":"C","name":"齐"}]'
const arenas = Array.from({ length: 7 }, (_, i) => ({
  id: 'arena' + i,
  ownerId: users[i % users.length].playerId,
  ownerName: users[i % users.length].displayName,
  ownerBanned: i === 5,
  gameId: 'camp_' + String(i).repeat(32).slice(0, 32),
  levelId: 'L' + (i % 2 + 1),
  levelName: i % 2 ? '第二关' : '第一关',
  campaignId: 'c' + i,
  campaignTitle: ['赤壁', '长平', 'Battle for Moscow'][i % 3],
  campaignFactionsJson: arenaFactions,
  roles: {
    A: { role: 'owner', bot: i % 2 ? { id: '', default: true } : { id: 'b' + i, name: '铁壁', ownerName: users[i % users.length].displayName } },
    B: { role: 'open', bot: null },
    ...(i % 3 === 0 ? { C: { role: 'bot', bot: { id: 'pkg:rush.json', packaged: true } } } : {}),
  },
  wins: (i * 7) % 11, losses: (i * 3) % 5, draws: i % 2, running: i % 3,
  createdAt: Date.now() - i * 86400000,
}))

// 素材管理：作者发布战役时传上来的素材（按内容哈希一份），供 素材管理 页跑通
function fakeSha(seed) {
  const hex = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 64; i++) s += hex[Math.floor(rand(seed * 97 + i) * 16)]
  return s
}
const assetExts = ['.png', '.png', '.jpg', '.ogg', '.png', '.ogv']
// 分类：每 5 个里一个是老包（未分类），其余轮着给几种用法
const assetUsages = [
  [{ layer: 'terrain', mode: 'random', ui: '' }],
  [{ layer: 'object', mode: 'image', ui: '' }, { layer: 'ui', mode: '', ui: 'button' }],
  [{ layer: 'edge', mode: 'chain', ui: '' }],
  [{ layer: 'background', mode: '', ui: '' }],
  [{ layer: 'effect', mode: '', ui: '' }],
]
const kindOfAssetExt = (ext, i) =>
  ['.ogv'].includes(ext) ? 'video' : ext === '.ogg' ? (i % 2 ? 'music' : 'sound') : ext ? 'image' : ''
const campaignAssets = Array.from({ length: 30 }, (_, i) => {
  const ext = assetExts[i % assetExts.length]
  const banned = i === 4 || i === 17
  const classified = i % 5 !== 2 && !banned
  return {
    classified,
    name: classified ? `素材${i + 1}${ext}` : '',
    kind: classified ? kindOfAssetExt(ext, i) : ext === '.ogg' ? 'audio' : kindOfAssetExt(ext, i),
    usages: classified ? (ext === '.ogg' ? [{ layer: 'background', mode: '', ui: '' }] : assetUsages[i % assetUsages.length]) : [],
    sha256: fakeSha(i + 1),
    size: Math.floor((20 + rand(i + 2) * 3000) * 1024),
    ext: banned && i === 17 ? '' : ext,
    isBanned: banned,
    createdAt: iso((30 - i) * 43200000 + rand(i) * 1e6),
    firstOwnerName: users[(i + 5) % users.length].displayName,
    campaignCount: banned ? 0 : 1 + Math.floor(rand(i + 3) * 4),
    shareCount: i % 4 === 0 ? 1 + (i % 3) : 0,
    approvedShareCount: i % 8 === 0 ? 1 : 0,
    pendingShareCount: i % 4 === 0 && i % 8 !== 0 ? 1 : 0,
    shareName: i % 4 === 0 ? `素材${i + 1}${ext}` : '',
    // mock 没有真文件：地址指向不存在的地方，视图走 @error 占位
    url: banned ? null : `https://files.example.invalid/assets/${fakeSha(i + 1).slice(0, 2)}/${fakeSha(i + 1)}${ext}`,
  }
})

const settings = [
  { key: 'campaign.quota', label: '每人能发几款游戏', value: '3', default: '3', unit: '款', type: 'int' },
  { key: 'campaign.maxTotalBytes', label: '每款游戏总容量(所有保留版本合计,同一文件只算一次)', value: String(200 * 1024 * 1024), default: String(200 * 1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'publish.perHour', label: '每人每小时发布次数(防刷)', value: '10', default: '10', unit: '次', type: 'int' },
  { key: 'campaign.autoApprove', label: '新游戏 / 新版本直接上架(关 = 等官方审核)', value: '1', default: '1', unit: '', type: 'bool' },
  { key: 'client.minMakerVersion', label: 'Maker 最低版本(空 = 不限)', value: '', default: '', unit: '', type: 'version' },
  { key: 'client.minLanServerVersion', label: '用户版服务器最低版本(空 = 不限)', value: '', default: '', unit: '', type: 'version' },
  { key: 'client.minGameVersion', label: '游戏 exe 最低版本(空 = 不限)', value: '', default: '', unit: '', type: 'version' },
  { key: 'client.problemVersions', label: '问题版本名单(逗号分隔;在座有人用它的桌不复核)', value: '', default: '', unit: '', type: 'versionList' },
  { key: 'report.enabled', label: '收举报', value: '1', default: '1', unit: '', type: 'bool' },
  { key: 'revision.tableReleaseDays', label: '旧版本几天后释放还没打完的桌', value: '21', default: '21', unit: '天', type: 'int' },
  { key: 'revision.keepDays', label: '旧版本几天后删除(须大于上一项)', value: '30', default: '30', unit: '天', type: 'int' },
]

const audit = Array.from({ length: 35 }, (_, i) => ({
  id: 1000 - i,
  actor: i % 5 === 2 ? 'reviewer:u0003' : 'zhongmingyu',
  action: ['user.ban', 'user.unban', 'campaign.rejected', 'campaign.ban', 'setting.write'][i % 5],
  target: ['u0003', 'u0007', 'c0009', 'r0021', 'campaign.quota'][i % 5],
  detail: JSON.stringify({ before: i, after: i + 1 }),
  createdAt: iso(i * 1800000),
}))

// ---- 通用检索工具 ----
function paginate(rows, page, pageSize = 20) {
  const total = rows.length
  const start = (page - 1) * pageSize
  return { total, page, pageSize, items: rows.slice(start, start + pageSize) }
}
function applySort(rows, sort, order, keyMap = {}) {
  if (!sort) return rows
  const key = keyMap[sort] || sort
  const dir = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = a[key], vb = b[key]
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return 0
  })
}
function contains(s, q) {
  return !q || String(s || '').toLowerCase().includes(String(q).toLowerCase())
}

function ok(data) {
  return Promise.resolve(data)
}
function fail(status, error) {
  return Promise.reject({ response: { status, data: { error } } })
}

// ---- 路由分发 ----
export function mockRequest(method, url, { params = {}, data = {} } = {}) {
  const m = method.toUpperCase()
  const p = url.replace(/^\/+/, '')

  // 登录
  if (m === 'POST' && p === 'admin/login') {
    if (data.username === 'zhongmingyu' && data.password === '854820') {
      return ok({ token: 'mock-admin-token', expiresAt: iso(-12 * 3600000), username: 'zhongmingyu' })
    }
    return fail(401, 'invalid_credentials')
  }
  if (m === 'POST' && p === 'admin/logout') return ok({})
  if (m === 'POST' && p === 'admin/change-password') {
    if (data.oldPassword !== '854820') return fail(403, 'wrong_password')
    if (!data.newPassword || data.newPassword.length < 6) return fail(400, 'invalid_new_password')
    return ok({ ok: true })
  }

  // 概览
  if (m === 'GET' && p === 'admin/overview') {
    return ok({
      userCount: users.length,
      bannedUserCount: users.filter((u) => u.isBanned).length,
      campaignCount: campaigns.filter((c) => !c.isDeleted).length,
      sharedAssetCount: library.filter((x) => x.status === 'approved').length,
      diskBytes: campaigns.reduce((s, x) => s + x.sizeBytes, 0),
    })
  }

  // 用户
  if (m === 'GET' && p === 'admin/users') {
    let rows = users.filter((u) => contains(u.displayName, params.q) || contains(u.email, params.q))
    rows = applySort(rows, params.sort || 'createdAt', params.order)
    return ok({
      ...paginate(rows, Number(params.page) || 1),
      defaults: { campaignQuota: 3 },
    })
  }
  let mu = p.match(/^admin\/users\/([^/]+)\/(ban|unban)$/)
  if (m === 'POST' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.isBanned = mu[2] === 'ban'
    return ok({ ok: true, isBanned: u.isBanned })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/reset-password$/)
  if (m === 'POST' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    if (u.email.endsWith('@placeholder.invalid')) return fail(400, 'steam_account_no_email')
    // mock 里假装发信失败，好看到「把密码给管理员」那个分支
    return ok({ ok: true, emailSent: false, email: u.email, password: 'Mock7kPq2xYz', mailError: 'not_configured' })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/campaign-quota$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.campaignQuota = Math.max(0, Number(data.count) || 0)
    return ok({ campaignQuota: u.campaignQuota })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/reviewer$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.isReviewer = !!data.isReviewer
    return ok({ isReviewer: u.isReviewer })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/featured-maker$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.isFeaturedMaker = !!data.isFeaturedMaker
    return ok({ isFeaturedMaker: u.isFeaturedMaker })
  }

  // 战役
  if (m === 'GET' && p === 'admin/campaigns') {
    let rows = campaigns.filter(
      (c) =>
        contains(c.title, params.q) &&
        (!params.owner || c.ownerPlayerId === params.owner) &&
        statusMatch(c, params.status),
    )
    rows = applySort(rows, params.sort || 'createdAt', params.order)
    return ok(paginate(rows, Number(params.page) || 1))
  }
  let mc = p.match(/^admin\/campaigns\/([^/]+)$/)
  if (m === 'GET' && mc) {
    const c = campaigns.find((x) => x.id === mc[1])
    return c ? ok(c) : fail(404, 'campaign_not_found')
  }
  if (m === 'DELETE' && mc) {
    const i = campaigns.findIndex((x) => x.id === mc[1])
    if (i < 0) return fail(404, 'campaign_not_found')
    campaigns.splice(i, 1)
    return ok({ ok: true })
  }
  mc = p.match(/^admin\/campaigns\/([^/]+)\/(ban|unban)$/)
  if (m === 'POST' && mc) {
    const c = campaigns.find((x) => x.id === mc[1])
    if (!c) return fail(404, 'campaign_not_found')
    c.isBanned = mc[2] === 'ban'
    return ok({ ok: true, isBanned: c.isBanned })
  }
  mc = p.match(/^admin\/campaigns\/([^/]+)\/featured$/)
  if (m === 'PUT' && mc) {
    const c = campaigns.find((x) => x.id === mc[1])
    if (!c) return fail(404, 'campaign_not_found')
    c.isFeatured = !!data.isFeatured
    return ok({ isFeatured: c.isFeatured })
  }
  mc = p.match(/^admin\/campaigns\/([^/]+)\/pinned$/)
  if (m === 'PUT' && mc) {
    const c = campaigns.find((x) => x.id === mc[1])
    if (!c) return fail(404, 'campaign_not_found')
    c.isPinned = !!data.isPinned
    return ok({ isPinned: c.isPinned })
  }

  // 房间
  if (m === 'GET' && p === 'admin/matches') {
    const rows = matches.filter(
      (x) => (!params.state || params.state === 'all' || x.state === params.state) && contains(x.campaignTitle, params.q),
    )
    return ok(paginate(rows, Number(params.page) || 1))
  }
  let mm = p.match(/^admin\/matches\/([^/]+)\/release$/)
  if (m === 'POST' && mm) {
    const i = matches.findIndex((x) => x.matchId === mm[1])
    if (i < 0) return fail(404, 'match_not_found')
    matches.splice(i, 1)
    return ok({ ok: true, released: true })
  }

  // 创意工坊条目名单
  if (m === 'GET' && p === 'workshop/bans') {
    return ok({ total: workshopBans.length, items: [...workshopBans] })
  }
  if (m === 'POST' && p === 'admin/workshop/bans') {
    const itemId = String(data.itemId || '').trim()
    if (!/^\d{1,20}$/.test(itemId) || itemId === '0') return fail(400, 'invalid_item_id')
    if (String(data.reason || '').length > 500) return fail(400, 'reason_too_long')
    const added = !workshopBans.some((b) => b.itemId === itemId)
    if (added) {
      workshopBans.unshift({ itemId, reason: data.reason || '', bannedBy: 'zhongmingyu', bannedAt: iso(0) })
    }
    return ok({ itemId, banned: true, added })
  }
  let mw = p.match(/^workshop\/bans\/([^/]+)$/)
  if (m === 'DELETE' && mw) {
    const i = workshopBans.findIndex((b) => b.itemId === mw[1])
    if (i < 0) return fail(404, 'ban_not_found')
    workshopBans.splice(i, 1)
    return ok({ itemId: mw[1], banned: false })
  }

  // 后台直传（演示：地址是 mock:，前端认得、不真传）
  if (m === 'POST' && p === 'admin/direct-uploads') {
    const uploadId = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)
    const partBytes = 16 * 1024 * 1024
    directUploads[uploadId] = data.files
    return ok({
      uploadId, partBytes,
      files: data.files.map((f) => ({ name: f.name, urls: Array.from({ length: Math.max(1, Math.ceil(f.size / partBytes)) }, (_, i) => `mock:${i}`) })),
    })
  }
  const mdu = p.match(/^admin\/direct-uploads\/([^/]+)$/)
  if (m === 'DELETE' && mdu) {
    delete directUploads[mdu[1]]
    return ok({ ok: true })
  }
  const mwd = p.match(/^admin\/web-template\/direct\/([^/]+)\/complete$/)
  if (m === 'POST' && mwd) {
    const files = directUploads[mwd[1]]
    if (!files) return fail(404, 'upload_not_found')
    delete directUploads[mwd[1]]
    const dir = Math.random().toString(16).slice(2, 10)
    const names = files.map((f) => f.name)
    webTemplates.push({ dir, size: files.reduce((s, f) => s + f.size, 0), fileCount: names.length, files: names, createdAt: iso(0),
      isCurrent: false, pending: true, retiredAt: iso(0), expiresAt: iso(-7 * 86400000) })
    return ok({ status: 'done', template: webTemplates.at(-1) })
  }

  // 用户版服务器（只读演示：上传 / 撤下要真服务器）
  if (m === 'GET' && p === 'admin/lan-server-releases') {
    return ok({
      chunkBytes: 16 * 1024 * 1024,
      minVersion: 0,
      minVersionKey: 'client.minLanServerVersion',
      items: [
        { version: 3, size: 84057652, sha256: 'ef'.repeat(32), createdAt: '2026-10-08T08:00:00Z', downloadCount: 5, archived: false, url: 'https://files.example.invalid/lan-server/v3-efefefef.exe' },
        { version: 2, size: 83900000, sha256: '12'.repeat(32), createdAt: '2026-10-01T08:00:00Z', downloadCount: 11, archived: true, url: null },
      ],
    })
  }

  // Maker 版本（只读演示：上传 / 撤下要真服务器）
  if (m === 'GET' && p === 'admin/maker-releases') {
    return ok({
      chunkBytes: 16 * 1024 * 1024,
      minVersion: 0,
      items: [
        { version: 3, size: 430377976, sha256: 'ef'.repeat(32), createdAt: '2026-10-14T08:00:00Z', downloadCount: 0, archived: false, pending: true, url: 'https://files.example.invalid/maker/v3-efefefef.exe' },
        { version: 2, size: 393377976, sha256: 'ab'.repeat(32), createdAt: '2026-10-02T08:00:00Z', downloadCount: 1, archived: false, url: 'https://files.example.invalid/maker/v2-abababab.exe' },
        { version: 1, size: 390000000, sha256: 'cd'.repeat(32), createdAt: '2026-09-30T08:00:00Z', downloadCount: 2, archived: true, url: null },
      ],
    })
  }

  // 游戏版本
  if (m === 'GET' && p === 'admin/game-data') {
    const gid = 'camp_' + 'a'.repeat(32)
    return ok({
      keepDays: 30,
      items: [
        { gameId: gid, title: '赤壁', campaignId: 'c1', version: 2, md5: 'd'.repeat(32), size: 3 * 1024 * 1024, createdAt: iso(2 * 86400000), state: 'current', deleteAfter: '', url: 'https://files.example.invalid/campaigns/d.zip' },
        { gameId: gid, title: '赤壁', campaignId: 'c1', version: 1, md5: 'e'.repeat(32), size: 3 * 1024 * 1024, createdAt: iso(9 * 86400000), state: 'retired', deleteAfter: iso(-28 * 86400000), url: 'https://files.example.invalid/campaigns/e.zip' },
      ],
    })
  }
  if (m === 'GET' && p === 'admin/game-releases') {
    const withCampaign = new Set(campaigns.filter((c) => c.gameId && !c.isDeleted).map((c) => c.gameId))
    return ok({
      chunkBytes: 16 * 1024 * 1024,
      minVersions: { ...gameMinVersions },
      items: gameReleases.map((r) => ({
        ...r,
        hasCampaign: withCampaign.has(r.gameId),
        url: r.archived ? null : `https://files.example.invalid/games/${r.gameId}/v${r.version}-${r.sha256.slice(0, 8)}.zip`,
      })),
    })
  }
  let mpc = p.match(/^admin\/game-releases\/([^/]+)\/campaign$/)
  if (m === 'POST' && mpc) {
    const latest = gameReleases.find((r) => r.gameId === mpc[1] && !r.archived)
    if (!latest) return fail(400, 'no_release')
    let camp = campaigns.find((c) => c.gameId === latest.gameId)
    const created = !camp
    if (!camp) {
      camp = {
        ...campaigns[2], id: 'c' + String(campaigns.length + 1).padStart(4, '0'), gameId: latest.gameId,
        title: latest.title, ownerName: '官方发布', workshopItemId: '', downloadCount: 0,
        isDeleted: false, isBanned: false, approvalStatus: 'approved', createdAt: iso(0),
      }
      campaigns.unshift(camp)
    }
    camp.gameVersion = latest.version
    return ok({ campaignId: camp.id, created })
  }
  if (m === 'POST' && p === 'admin/game-releases/uploads') {
    const uploadId = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)
    gameUploads[uploadId] = 0
    return ok({ uploadId, chunkBytes: 16 * 1024 * 1024 })
  }
  let mg = p.match(/^admin\/game-releases\/uploads\/([^/]+)$/)
  if (m === 'PUT' && mg) {
    if (!(mg[1] in gameUploads)) return fail(404, 'upload_not_found')
    gameUploads[mg[1]] += data?.size || 0
    return ok({ received: gameUploads[mg[1]] })
  }
  mg = p.match(/^admin\/game-releases\/uploads\/([^/]+)\/complete$/)
  if (m === 'POST' && mg) {
    const size = gameUploads[mg[1]]
    if (size === undefined) return fail(404, 'upload_not_found')
    delete gameUploads[mg[1]]
    return registerGameMock(size)
  }
  mg = p.match(/^admin\/game-releases\/direct\/([^/]+)\/complete$/)
  if (m === 'POST' && mg) {
    const files = directUploads[mg[1]]
    if (!files) return fail(404, 'upload_not_found')
    delete directUploads[mg[1]]
    return registerGameMock(files[0].size)
  }
  mg = p.match(/^admin\/game-releases\/([^/]+)\/min-version$/)
  if (m === 'PUT' && mg) {
    const latest = gameReleases.find((r) => r.gameId === mg[1] && !r.archived)
    const v = Number(data?.version) || 0
    if (v && (!latest || v > latest.version)) return fail(400, 'version_too_new')
    if (v) gameMinVersions[mg[1]] = v
    else delete gameMinVersions[mg[1]]
    return ok({ ok: true, minVersion: v })
  }
  mg = p.match(/^admin\/game-releases\/([^/]+)\/(\d+)$/)
  if (m === 'DELETE' && mg) {
    const i = gameReleases.findIndex((r) => r.gameId === mg[1] && r.version === Number(mg[2]))
    if (i < 0) return fail(404, 'game_release_not_found')
    gameReleases.splice(i, 1)
    return ok({ ok: true })
  }

  // 网页版模板
  if (m === 'GET' && p === 'admin/web-template') {
    return ok(webTemplateState())
  }
  if (m === 'POST' && p === 'admin/web-template/uploads') {
    const uploadId = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)
    webUploads[uploadId] = 0
    return ok({ uploadId, chunkBytes: 16 * 1024 * 1024 })
  }
  let mwt = p.match(/^admin\/web-template\/uploads\/([^/]+)$/)
  if (m === 'PUT' && mwt) {
    if (!(mwt[1] in webUploads)) return fail(404, 'upload_not_found')
    webUploads[mwt[1]] += data?.size || 0
    return ok({ received: webUploads[mwt[1]] })
  }
  mwt = p.match(/^admin\/web-template\/uploads\/([^/]+)\/complete$/)
  if (m === 'POST' && mwt) {
    const size = webUploads[mwt[1]]
    if (size === undefined) return fail(404, 'upload_not_found')
    delete webUploads[mwt[1]]
    const dir = Math.random().toString(16).slice(2, 10)
    webTemplates.push({ dir, size, fileCount: webFiles.length, files: webFiles, createdAt: iso(0),
      isCurrent: false, pending: true, retiredAt: iso(0), expiresAt: iso(-7 * 86400000) })
    return ok({ status: 'done', template: webTemplates.at(-1) })
  }
  const mwa = p.match(/^admin\/web-template\/([^/]+)\/activate$/)
  if (m === 'POST' && mwa) {
    if (!activateWebTemplate(mwa[1])) return fail(404, 'template_not_found')
    return ok(webTemplateState())
  }
  const mwl = p.match(/^admin\/campaigns\/([^/]+)\/web-login-required$/)
  if (m === 'PUT' && mwl) {
    const c = campaigns.find((x) => x.id === mwl[1])
    if (!c) return fail(404, 'campaign_not_found')
    c.webLoginRequired = !!data?.loginRequired
    return ok({ ok: true })
  }

  // 资源库审核
  if (m === 'GET' && p === 'admin/library') {
    const rows = library.filter((x) =>
      (!params.status || params.status === 'all' ? true : x.status === (params.status || 'pending')) &&
      (!params.kind || x.kind === params.kind) &&
      (!params.layer || x.usages.some((u) => u.layer === params.layer)) &&
      contains(x.name, params.q))
    return ok(paginate(rows, Number(params.page) || 1))
  }
  if (m === 'POST' && p === 'admin/library/batch') {
    const hit = library.filter((r) => (data?.ids || []).includes(r.id))
    if (data?.action === 'ban') {
      const shas = new Set(hit.map((r) => r.sha256))
      for (let i = library.length - 1; i >= 0; i--) if (shas.has(library[i].sha256)) library.splice(i, 1)
      return ok({ action: 'ban', banned: shas.size })
    }
    if (data?.action !== 'approve' && data?.action !== 'reject') return fail(400, 'invalid_action')
    for (const x of hit) {
      x.status = data.action === 'approve' ? 'approved' : 'rejected'
      x.rejectReason = data.action === 'reject' ? data?.reason || '' : ''
    }
    return ok({ action: data.action, changed: hit.length })
  }
  const ml = p.match(/^admin\/library\/([^/]+)\/(approve|reject)$/)
  if (m === 'POST' && ml) {
    const x = library.find((r) => r.id === ml[1])
    if (!x) return fail(404, 'shared_asset_not_found')
    x.status = ml[2] === 'approve' ? 'approved' : 'rejected'
    x.rejectReason = ml[2] === 'reject' ? data?.reason || '' : ''
    return ok({ id: x.id, status: x.status, rejectReason: x.rejectReason })
  }

  // 擂台
  if (m === 'GET' && p === 'admin/arenas') {
    const rows = arenas.filter((x) => contains(x.campaignTitle, params.q) || contains(x.ownerName, params.q))
    return ok(paginate(rows, Number(params.page) || 1))
  }
  const mar = p.match(/^admin\/arenas\/([^/]+)$/)
  if (m === 'DELETE' && mar) {
    const i = arenas.findIndex((x) => x.id === mar[1])
    if (i < 0) return fail(404, 'arena_not_found')
    arenas.splice(i, 1)
    return ok({ ok: true })
  }

  // 素材管理
  if (m === 'GET' && p === 'admin/campaign-assets') {
    let rows = campaignAssets.filter((x) =>
      (!params.kind || x.kind === params.kind || (x.kind === 'audio' && ['sound', 'music'].includes(params.kind))) &&
      (!params.classified || x.classified === (params.classified === 'yes')) &&
      (!(params.layer || params.mode || params.ui) || x.usages.some((u) =>
        (!params.layer || u.layer === params.layer) && (!params.mode || u.mode === params.mode) && (!params.ui || u.ui === params.ui))) &&
      (params.status === 'active' ? !x.isBanned : params.status === 'banned' ? x.isBanned : params.status === 'shared' ? x.shareCount > 0 :
        params.status === 'listed' ? x.approvedShareCount > 0 : params.status === 'sharePending' ? x.pendingShareCount > 0 : true) &&
      (!params.q || x.sha256.startsWith(String(params.q).toLowerCase()) || contains(x.shareName, params.q)))
    rows = applySort(rows, params.sort || 'createdAt', params.order, { campaigns: 'campaignCount' })
    return ok(paginate(rows, Number(params.page) || 1))
  }
  if (m === 'POST' && p === 'admin/campaign-assets/batch') {
    const hit = campaignAssets.filter((x) => (data?.shas || []).includes(x.sha256))
    if (data?.action === 'unlist') {
      const n = hit.reduce((sum, x) => sum + x.approvedShareCount, 0)
      hit.forEach((x) => { x.approvedShareCount = 0 })
      return ok({ action: 'unlist', changed: n })
    }
    if (data?.action === 'ban') {
      hit.forEach((x) => Object.assign(x, { isBanned: true, url: null }))
      return ok({ action: 'ban', changed: (data.shas || []).length })
    }
    if (data?.action === 'delete') {
      for (const x of hit) campaignAssets.splice(campaignAssets.indexOf(x), 1)
      return ok({ action: 'delete', changed: hit.length })
    }
    return fail(400, 'invalid_action')
  }
  let ma = p.match(/^admin\/campaign-assets\/([0-9a-f]{64})$/)
  if (m === 'GET' && ma) {
    const x = campaignAssets.find((r) => r.sha256 === ma[1])
    if (!x) return fail(404, 'campaign_asset_not_found')
    return ok({
      sha256: x.sha256,
      campaigns: campaigns.slice(0, x.campaignCount).map((c, i) => ({
        campaignId: c.id, title: c.title, campaignBanned: !!c.isBanned, gameVersion: 1 + i,
        status: 'approved', isLive: true, isPending: false,
        name: x.name, kind: x.classified ? x.kind : '', usages: x.usages, uploaderName: users[i % users.length].displayName,
      })),
      shareCandidates: x.classified
        ? campaigns.slice(0, x.campaignCount).map((c, i) => ({
          ownerPlayerId: users[i % users.length].playerId, ownerName: users[i % users.length].displayName,
          campaignTitle: c.title, gameVersion: 1 + i, name: x.name, kind: x.kind, usages: x.usages,
          hasGrid: x.ext === '.png', existingShareStatus: i < x.shareCount ? 'pending' : '',
        }))
        : [],
      shares: Array.from({ length: x.shareCount }, (_, i) => ({
        id: `s${i}`, name: x.shareName, status: i < x.approvedShareCount ? 'approved' : 'pending', rejectReason: '',
        ownerName: users[i % users.length].displayName, createdAt: x.createdAt, downloadCount: i * 3,
      })),
    })
  }
  ma = p.match(/^admin\/campaign-assets\/([0-9a-f]{64})\/share$/)
  if (m === 'POST' && ma) {
    const x = campaignAssets.find((r) => r.sha256 === ma[1])
    if (!x) return fail(404, 'campaign_asset_not_found')
    if (!x.classified) return fail(409, 'asset_not_classified')
    const name = (data?.name || '').trim() || x.name
    Object.assign(x, { shareCount: x.shareCount + 1, approvedShareCount: x.approvedShareCount + 1, shareName: x.shareName || name })
    return ok({ ok: true, sha256: x.sha256, ownerPlayerId: data?.ownerPlayerId, name })
  }
  ma = p.match(/^admin\/campaign-assets\/([0-9a-f]{64})\/(ban|unban|unlist)$/)
  if (m === 'POST' && ma) {
    const i = campaignAssets.findIndex((r) => r.sha256 === ma[1])
    if (ma[2] === 'ban') {
      if (i >= 0) Object.assign(campaignAssets[i], { isBanned: true, url: null })
      return ok({ ok: true, sha256: ma[1], existed: i >= 0 })
    }
    if (ma[2] === 'unlist') {
      const n = i >= 0 ? campaignAssets[i].approvedShareCount : 0
      if (i >= 0) campaignAssets[i].approvedShareCount = 0
      return ok({ ok: true, sha256: ma[1], unlisted: n })
    }
    if (i < 0 || !campaignAssets[i].isBanned) return fail(404, 'campaign_asset_not_banned')
    campaignAssets.splice(i, 1)
    return ok({ ok: true, sha256: ma[1] })
  }

  // 配置
  if (m === 'GET' && p === 'admin/settings') return ok({ items: settings })
  if (m === 'PUT' && p === 'admin/settings') {
    const items = data.items || (data.key ? { [data.key]: data.value } : {})
    for (const [k, v] of Object.entries(items)) {
      const s = settings.find((x) => x.key === k)
      if (s) s.value = String(v)
    }
    return ok({ items: settings })
  }
  if (m === 'POST' && p === 'admin/blob-gc/run') {
    return ok({ oldTablesReleased: 1, oldPackagesDeleted: 1, revisionsExpired: 2, campaignAssetsDeleted: 5 })
  }

  // 审计
  if (m === 'GET' && p === 'admin/audit') {
    return ok(paginate(audit, Number(params.page) || 1))
  }
  if (m === 'GET' && p === 'admin/login-logs') {
    return ok(paginate(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, email: 'demo@example.com', displayName: '演示用户', machineFingerprint: i % 3 === 0 ? '' : 'a'.repeat(64), clientVersion: i % 3 === 0 ? '' : '0.1.3', ipAddress: '127.0.0.1', lastSessionMinutes: i % 3 === 0 ? 0 : i * 37, lastActiveMinutes: i % 3 === 0 ? 0 : i * 10, createdAt: iso(-i * 3600000) })), Number(params.page) || 1))
  }

  if (m === 'GET' && p === 'admin/license-orders') {
    return ok({ items: Array.from({ length: 6 }, (_, i) => ({ orderId: `demo-order-${i + 1}`, appId: 'warsim-maker', email: `buyer${i + 1}@example.com`, licenseKey: `SAND-DEMO-${1000 + i}`, lang: i % 2 ? 'en' : 'zh', discountCode: i === 2 ? 'EARLY' : '', priceId: 'echoshorts-license_2', orderCreatedAt: iso(-i * 86400000), receivedAt: iso(-i * 86400000 + 60000), activatedBy: i % 3 === 0 ? null : { playerId: `p${i}`, displayName: '演示用户', email: 'demo@example.com' } })) })
  }

  return fail(404, 'mock_route_not_found: ' + m + ' ' + p)
}

function statusMatch(x, status) {
  switch (status) {
    case 'live':
      return !x.isDeleted
    case 'active':
      return !x.isDeleted && !x.isBanned
    case 'deleted':
      return x.isDeleted
    case 'banned':
      return x.isBanned
    default:
      return true // all
  }
}
