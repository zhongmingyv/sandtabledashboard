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

export const http = {
  get: (url, params) => request('GET', url, { params }),
  post: (url, data, params) => request('POST', url, { data, params }),
  put: (url, data, params) => request('PUT', url, { data, params }),
  del: (url, params) => request('DELETE', url, { params }),
}
