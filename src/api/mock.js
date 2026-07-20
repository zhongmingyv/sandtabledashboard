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
  gold: Math.floor(rand(i + 1) * 5000),
  blobQuotaBytes: i % 5 === 0 ? 128 * 1024 * 1024 : 0,
  campaignQuota: i % 4 === 0 ? 5 : 0,
  resourceQuota: i % 6 === 0 ? 20 : 0,
  isBanned: i % 11 === 3,
  campaignCount: Math.floor(rand(i + 2) * 4),
  resourceCount: Math.floor(rand(i + 3) * 10),
  blobStorageBytes: Math.floor(rand(i + 4) * 64 * 1024 * 1024),
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
    price: i % 3 === 0 ? 0 : Math.floor(rand(i) * 500),
    downloadCount: Math.floor(rand(i + 5) * 200),
    replayCount: Math.floor(rand(i + 6) * 8),
    isDeleted: i % 9 === 4,
    isBanned: i % 13 === 7,
    sizeBytes: Math.floor((1 + rand(i + 7) * 24) * 1024 * 1024),
  }
})

const layers = ['background', 'height', 'terrain', 'edge', 'road', 'object', 'ui']
const resources = Array.from({ length: 50 }, (_, i) => {
  const owner = users[(i + 3) % users.length]
  return {
    id: 'r' + String(i + 1).padStart(4, '0'),
    ownerPlayerId: owner.playerId,
    ownerName: owner.displayName,
    title: `资源·${layers[i % layers.length]}${i + 1}`,
    layerType: layers[i % layers.length],
    tagsJson: JSON.stringify(['tag' + (i % 5)]),
    createdAt: iso((50 - i) * 43200000),
    price: i % 4 === 0 ? 0 : Math.floor(rand(i) * 300),
    downloadCount: Math.floor(rand(i + 8) * 500),
    isDeleted: i % 8 === 2,
    isBanned: i % 15 === 6,
    sizeBytes: Math.floor((0.2 + rand(i + 9) * 20) * 1024 * 1024),
  }
})

// 图床 blob store（内容寻址）：混合图片/音频，供 图床管理 页跑通
function fakeSha(seed) {
  const hex = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 64; i++) s += hex[Math.floor(rand(seed * 97 + i) * 16)]
  return s
}
const imageMedia = ['image/png', 'image/jpeg', 'image/webp']
const audioMedia = ['audio/ogg', 'audio/mpeg', 'audio/wav']
const blobLayerSets = [
  '["terrain"]', '["terrain","road"]', '["object"]', '["ui"]', '[]',
  '["background"]', '["height"]', '["edge"]', '["road","object"]',
]
const blobs = Array.from({ length: 12 }, (_, i) => {
  const isAudio = i % 3 === 2
  const owner = users[(i + 5) % users.length]
  return {
    sha256: fakeSha(i + 1),
    size: isAudio
      ? Math.floor((30 + rand(i + 1) * 900) * 1024)
      : Math.floor((20 + rand(i + 2) * 3000) * 1024),
    width: isAudio ? 0 : [256, 512, 1024, 2048][i % 4],
    height: isAudio ? 0 : [256, 512, 1024, 1024][i % 4],
    mediaType: isAudio ? audioMedia[i % audioMedia.length] : imageMedia[i % imageMedia.length],
    createdAt: iso((12 - i) * 43200000 + rand(i) * 1e6),
    refCount: Math.floor(rand(i + 3) * 6),
    layersJson: isAudio ? '[]' : blobLayerSets[i % blobLayerSets.length],
    ownerName: owner.displayName,
    isBanned: i === 4 || i === 9,
  }
})

const replays = Array.from({ length: 60 }, (_, i) => {
  const c = campaigns[i % campaigns.length]
  return {
    replayId: 'p' + String(i + 1).padStart(4, '0'),
    campaignId: c.id,
    campaignTitle: c.title,
    matchId: 'm' + String((i % 25) + 1).padStart(4, '0'),
    title: `复盘 #${i + 1}`,
    opCount: 100 + Math.floor(rand(i) * 5000),
    createdAt: iso(i * 3600000),
    matchOpBytes: Math.floor((0.1 + rand(i + 1) * 5) * 1024 * 1024),
    sharedByReplayCount: 1 + (i % 3),
  }
})

const settings = [
  { key: 'campaign.quota', label: '战役上传数/人', value: '3', default: '3', unit: '个', type: 'int' },
  { key: 'resource.quota', label: '资源上传数/人', value: '10', default: '10', unit: '个', type: 'int' },
  { key: 'campaign.maxPackageBytes', label: '单战役包上限', value: String(25 * 1024 * 1024), default: String(25 * 1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'resource.maxPackageBytes', label: '单资源包上限', value: String(25 * 1024 * 1024), default: String(25 * 1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'blob.maxImageBytes', label: '单张图片上限', value: String(4 * 1024 * 1024), default: String(4 * 1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'blob.maxAudioBytes', label: '单个音频上限', value: String(1024 * 1024), default: String(1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'blob.quota.tier0.maxTotalBytes', label: '图床总量/人 Tier0', value: String(64 * 1024 * 1024), default: String(64 * 1024 * 1024), unit: '字节', type: 'bytes' },
  { key: 'blob.quota.tier1.maxTotalBytes', label: '图床总量/人 Tier1', value: String(512 * 1024 * 1024), default: String(512 * 1024 * 1024), unit: '字节', type: 'bytes' },
]

const audit = Array.from({ length: 35 }, (_, i) => ({
  id: 1000 - i,
  actor: 'zhongmingyu',
  action: ['user.ban', 'user.gold', 'content.ban', 'content.delete', 'setting.write'][i % 5],
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
      resourceCount: resources.filter((r) => !r.isDeleted).length,
      replayCount: replays.length,
      diskBytes: [...campaigns, ...resources].reduce((s, x) => s + x.sizeBytes, 0),
    })
  }

  // 用户
  if (m === 'GET' && p === 'admin/users') {
    let rows = users.filter((u) => contains(u.displayName, params.q) || contains(u.email, params.q))
    rows = applySort(rows, params.sort || 'createdAt', params.order)
    return ok({
      ...paginate(rows, Number(params.page) || 1),
      defaults: { campaignQuota: 3, resourceQuota: 10, blobTotalBytes: 64 * 1024 * 1024 },
    })
  }
  let mu = p.match(/^admin\/users\/([^/]+)\/(ban|unban)$/)
  if (m === 'POST' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.isBanned = mu[2] === 'ban'
    return ok({ ok: true, isBanned: u.isBanned })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/gold$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.gold = Number(data.gold) || 0
    return ok({ gold: u.gold })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/gold\/adjust$/)
  if (m === 'POST' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.gold = Math.max(0, u.gold + (Number(data.delta) || 0))
    return ok({ gold: u.gold })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/blob-quota$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.blobQuotaBytes = Math.max(0, Number(data.bytes) || 0)
    return ok({ blobQuotaBytes: u.blobQuotaBytes })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/campaign-quota$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.campaignQuota = Math.max(0, Number(data.count) || 0)
    return ok({ campaignQuota: u.campaignQuota })
  }
  mu = p.match(/^admin\/users\/([^/]+)\/resource-quota$/)
  if (m === 'PUT' && mu) {
    const u = users.find((x) => x.playerId === mu[1])
    if (!u) return fail(404, 'user_not_found')
    u.resourceQuota = Math.max(0, Number(data.count) || 0)
    return ok({ resourceQuota: u.resourceQuota })
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

  // 图床（内容寻址 blob store）
  if (m === 'GET' && p === 'admin/blobs') {
    const kindOf = (b) => (String(b.mediaType).startsWith('audio/') ? 'audio' : 'image')
    let rows = blobs.filter((b) => {
      if (params.kind && params.kind !== 'all' && kindOf(b) !== params.kind) return false
      if (params.layer) {
        let ls = []
        try { ls = JSON.parse(b.layersJson || '[]') } catch { ls = [] }
        if (!ls.includes(params.layer)) return false
      }
      if (params.status === 'active' && b.isBanned) return false
      if (params.status === 'banned' && !b.isBanned) return false
      if (params.owner && b.ownerName !== params.owner) return false
      if (params.q && !String(b.sha256).toLowerCase().startsWith(String(params.q).toLowerCase())) return false
      return true
    })
    rows = applySort(rows, params.sort || 'createdAt', params.order)
    return ok(paginate(rows, Number(params.page) || 1))
  }
  let mr = p.match(/^admin\/blobs\/([^/]+)\/(ban|unban)$/)
  if (m === 'POST' && mr) {
    const b = blobs.find((x) => x.sha256 === mr[1])
    if (!b) return fail(404, 'blob_not_found')
    b.isBanned = mr[2] === 'ban'
    return ok({ ok: true, isBanned: b.isBanned })
  }
  mr = p.match(/^admin\/blobs\/([^/]+)\/(thumb|raw)$/)
  if (m === 'GET' && mr) {
    // mock 无真实字节，返回空占位；视图侧走 error/placeholder 兜底
    return ok(new Blob([], { type: 'application/octet-stream' }))
  }
  mr = p.match(/^admin\/blobs\/([^/]+)$/)
  if (m === 'DELETE' && mr) {
    const i = blobs.findIndex((x) => x.sha256 === mr[1])
    if (i < 0) return fail(404, 'blob_not_found')
    const freedBytes = blobs[i].size
    blobs.splice(i, 1)
    return ok({ ok: true, freedBytes })
  }

  // 复盘
  if (m === 'GET' && p === 'admin/replays') {
    let rows = replays.filter((r) => !params.campaignId || r.campaignId === params.campaignId)
    rows = applySort(rows, params.sort || 'createdAt', params.order)
    return ok(paginate(rows, Number(params.page) || 1))
  }
  let mp = p.match(/^admin\/replays\/([^/]+)$/)
  if (m === 'DELETE' && mp) {
    const i = replays.findIndex((x) => x.replayId === mp[1])
    if (i < 0) return fail(404, 'replay_not_found')
    replays.splice(i, 1)
    return ok({ ok: true, purgedOps: params.purgeOps === 'true' || params.purgeOps === true })
  }
  if (m === 'POST' && p === 'admin/replays/batch-delete') {
    let removed = 0
    if (Array.isArray(data.replayIds)) {
      for (const id of data.replayIds) {
        const i = replays.findIndex((x) => x.replayId === id)
        if (i >= 0) { replays.splice(i, 1); removed++ }
      }
    } else if (data.campaignId || data.before) {
      for (let i = replays.length - 1; i >= 0; i--) {
        const r = replays[i]
        if (data.campaignId && r.campaignId !== data.campaignId) continue
        if (data.before && new Date(r.createdAt) >= new Date(data.before)) continue
        replays.splice(i, 1); removed++
      }
    }
    return ok({ removed, purgedOps: !!data.purgeOps })
  }
  if (m === 'DELETE' && p.match(/^admin\/matches\/([^/]+)\/ops$/)) {
    return ok({ ok: true, freedBytes: Math.floor(rand(7) * 5 * 1024 * 1024) })
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
    return ok({ refsRemoved: 3, blobsDeleted: 5, filesDeleted: 5 })
  }

  // 审计
  if (m === 'GET' && p === 'admin/audit') {
    return ok(paginate(audit, Number(params.page) || 1))
  }

  return fail(404, 'mock_route_not_found: ' + m + ' ' + p)
}

function statusMatch(x, status) {
  switch (status) {
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
