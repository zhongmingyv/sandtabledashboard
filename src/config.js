// API 基地址：优先 .env 的 VITE_API_BASE；否则按环境回退。
// 生产（Cloudflare Pages 构建）默认打到 api.sandtable.club。
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? 'https://api.sandtable.club' : 'http://localhost:5000')

// 后端 /admin/* 未实现时用内置 mock，前端可独立跑通。默认开发开、生产关。
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK !== undefined
    ? import.meta.env.VITE_USE_MOCK === 'true'
    : !import.meta.env.PROD

export const PAGE_SIZE = 20
