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
  setGold: (id, gold) => http.put(`/admin/users/${id}/gold`, { gold }),
  adjustGold: (id, delta) => http.post(`/admin/users/${id}/gold/adjust`, { delta }),
  setQuotaTier: (id, tier) => http.put(`/admin/users/${id}/quota-tier`, { tier }),

  // 战役
  campaigns: (params) => http.get('/admin/campaigns', params),
  campaign: (id) => http.get(`/admin/campaigns/${id}`),
  banCampaign: (id) => http.post(`/admin/campaigns/${id}/ban`),
  unbanCampaign: (id) => http.post(`/admin/campaigns/${id}/unban`),
  deleteCampaign: (id) => http.del(`/admin/campaigns/${id}`),

  // 资源
  resources: (params) => http.get('/admin/resources', params),
  resource: (id) => http.get(`/admin/resources/${id}`),
  banResource: (id) => http.post(`/admin/resources/${id}/ban`),
  unbanResource: (id) => http.post(`/admin/resources/${id}/unban`),
  deleteResource: (id) => http.del(`/admin/resources/${id}`),

  // 复盘 / 操作流
  replays: (params) => http.get('/admin/replays', params),
  deleteReplay: (id, purgeOps) => http.del(`/admin/replays/${id}`, { purgeOps }),
  batchDeleteReplays: (payload) => http.post('/admin/replays/batch-delete', payload),
  purgeMatchOps: (id) => http.del(`/admin/matches/${id}/ops`),

  // 配置
  settings: () => http.get('/admin/settings'),
  saveSettings: (items) => http.put('/admin/settings', { items }),
  runBlobGc: () => http.post('/admin/blob-gc/run'),

  // 审计
  audit: (params) => http.get('/admin/audit', params),
}
