import axios from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE, USE_MOCK } from '../config'
import { mockRequest } from './mock'
import router from '../router'

const instance = axios.create({ baseURL: API_BASE, timeout: 15000 })

instance.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('slgm_admin_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

function handleUnauthorized() {
  localStorage.removeItem('slgm_admin_token')
  localStorage.removeItem('slgm_admin_user')
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'login' })
  }
}

// 统一请求入口：USE_MOCK 时走内存 mock，否则真 axios。两条路径返回/抛出形状一致。
export async function request(method, url, { params, data } = {}) {
  try {
    if (USE_MOCK) {
      // mock 也校验 token（login 除外），模拟鉴权
      if (!url.includes('admin/login') && !localStorage.getItem('slgm_admin_token')) {
        handleUnauthorized()
        throw { response: { status: 401, data: { error: 'unauthorized' } } }
      }
      return await mockRequest(method, url, { params, data })
    }
    const resp = await instance.request({ method, url, params, data })
    return resp.data
  } catch (err) {
    const status = err?.response?.status
    const code = err?.response?.data?.error
    if (status === 401) {
      handleUnauthorized()
    } else if (status && url && !url.includes('admin/login')) {
      ElMessage.error(code ? `请求失败：${code}` : `请求失败（${status}）`)
    } else if (!status && !USE_MOCK) {
      ElMessage.error('网络错误，无法连接后端')
    }
    throw err
  }
}

// 二进制拉取（缩略图/音频）：<img>/<audio> 标签无法带 Authorization，
// 故走 axios 以 blob 形式取回，返回形状对齐 { data: Blob } 供 URL.createObjectURL 使用。
// MOCK 下没有真实字节，返回一个占位空 blob，让视图走 error/placeholder 兜底。
export async function requestBlob(url) {
  if (USE_MOCK) {
    if (!localStorage.getItem('slgm_admin_token')) {
      handleUnauthorized()
      throw { response: { status: 401, data: { error: 'unauthorized' } } }
    }
    // 占位：非图片/音频字节，视图侧 <img>/<audio> 会触发 error 事件走占位兜底
    return { data: new Blob([], { type: 'application/octet-stream' }) }
  }
  try {
    const resp = await instance.request({ method: 'GET', url, responseType: 'blob' })
    return { data: resp.data }
  } catch (err) {
    const status = err?.response?.status
    if (status === 401) handleUnauthorized()
    throw err
  }
}

export const http = {
  get: (url, params) => request('GET', url, { params }),
  post: (url, data, params) => request('POST', url, { data, params }),
  put: (url, data, params) => request('PUT', url, { data, params }),
  del: (url, params) => request('DELETE', url, { params }),
  getBlob: (url) => requestBlob(url),
}
